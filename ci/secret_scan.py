#!/usr/bin/env python3
"""Secret scan of a merge request diff, of the staged changes, or of the whole tree.

Adapted from the X10 team's ai-sdlc (the secret patterns of `.claude/hooks/pre_bash_guard.py`)
for projects made by Prompt Serve Coder. This file is the single list of secret patterns: the
agent hook `.claude/hooks/pre_bash_guard.py` imports it, so the CI job `gate:secret-scan` and the
hook always agree on what counts as a secret.

Usage (Python 3 standard library only):
  python3 ci/secret_scan.py               in a merge request pipeline: the lines the MR adds,
                                          otherwise every tracked file of the repository
  python3 ci/secret_scan.py --base <sha>  the lines added between <sha> and HEAD
  python3 ci/secret_scan.py --staged      the staged changes (what `git commit` would record)
  python3 ci/secret_scan.py --tree        every tracked file

Exit 0 when nothing is found, 1 when a finding blocks, 2 when the scan itself cannot run.
A finding is reported as `path:line` and the kind of secret, never the value, so the CI log does
not repeat the secret it found.

To add an organisation-specific key format, add one `(label, regex)` pair to SECRET_PATTERNS and
a case for it in `ci/tests/test_secret_scan.py`. A false positive is resolved by a person: change
the line so it no longer looks like a credential (for example read the value from an environment
variable), there is deliberately no inline marker that an agent could add to silence the scan.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from typing import Iterable, List, Optional, Tuple

SECRET_PATTERNS: List[Tuple[str, "re.Pattern[str]"]] = [
    ("AWS access key ID", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("private key block", re.compile(r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----")),
    (
        "hardcoded credential-looking assignment",
        re.compile(r"(?i)(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['\"][A-Za-z0-9/_+\-.]{16,}['\"]"),
    ),
    ("OpenAI/Anthropic-style API key", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}")),
    ("GitLab personal or project access token", re.compile(r"\bglpat-[A-Za-z0-9_\-]{20,}")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}")),
    # Prompt Serve Coder 2.0: what AI agents most often leave in code.
    ("password in a connection string", re.compile(r"\b[a-z][a-z0-9+.\-]*://[^\s/:@'\"$}{]+:[^\s/@'\"$}{]{3,}@[^\s'\"]+")),
    ("JSON Web Token", re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")),
    (
        "short password written in code",
        re.compile(r"(?i)(?:password|passwd|pwd|client_secret)\s*[:=]\s*['\"][^'\"\s$}{]{6,}['\"]"),
    ),
]

# Files that hold secrets by their nature, whatever their content.
SECRET_FILE_NAMES = re.compile(
    r"^(?:\.env|\.env\..+|id_rsa|id_dsa|id_ecdsa|id_ed25519|.+\.pem|.+\.p12|.+\.pfx|.+\.key)$"
)
ALLOWED_FILE_NAMES = re.compile(r"^\.env\.(?:example|sample|template)$")

MAX_FILE_BYTES = 1_000_000

Finding = Tuple[str, int, str]


def scan_text(text: str) -> List[Tuple[int, str]]:
    """(line number, label) of every line that looks like it holds a secret."""
    found = []
    for number, line in enumerate(text.splitlines(), start=1):
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(line):
                found.append((number, label))
                break
    return found


def secret_file(path: str) -> Optional[str]:
    """A label when the file's name alone marks it as a secret, otherwise None."""
    name = path.rstrip("/").rsplit("/", 1)[-1]
    if ALLOWED_FILE_NAMES.match(name) or not SECRET_FILE_NAMES.match(name):
        return None
    return "file that holds secrets by its name (.env, private key or certificate)"


_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def scan_diff(diff: str) -> List[Finding]:
    """Findings in the lines a unified diff adds, and in the names of the files it changes."""
    found: List[Finding] = []
    path: Optional[str] = None
    header = False
    line = 0
    for raw in diff.splitlines():
        if raw.startswith("diff --git "):
            path, header = None, True
            continue
        if header:
            # File headers come between `diff --git` and the first hunk only, so an added line
            # that happens to start with `++ ` is never read as a header.
            if raw.startswith("+++ "):
                target = raw[4:]
                path = None if target == "/dev/null" else (target[2:] if target.startswith("b/") else target)
                label = secret_file(path) if path else None
                if path and label:
                    found.append((path, 0, label))
                continue
            if not raw.startswith("@@"):
                continue
            header = False
        hunk = _HUNK.match(raw)
        if hunk:
            line = int(hunk.group(1))
            continue
        if path is None:
            continue
        if raw.startswith("+"):
            for label, pattern in SECRET_PATTERNS:
                if pattern.search(raw[1:]):
                    found.append((path, line, label))
                    break
            line += 1
        elif raw.startswith(" "):
            line += 1
    return found


def git(args: List[str], cwd: Optional[str] = None) -> str:
    result = subprocess.run(
        ["git", "-c", "core.quotePath=false", *args], cwd=cwd, capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {result.stderr.strip()}")
    return result.stdout


def diff_of(base: Optional[str], staged: bool = False, cwd: Optional[str] = None) -> str:
    common = ["diff", "--no-color", "--no-ext-diff", "--unified=0", "--no-renames"]
    if staged:
        return git([*common, "--cached"], cwd)
    return git([*common, base or "HEAD", "HEAD"], cwd)


def scan_tree(cwd: Optional[str] = None) -> List[Finding]:
    found: List[Finding] = []
    root = cwd or "."
    for path in git(["ls-files", "-z"], cwd).split("\0"):
        if not path:
            continue
        label = secret_file(path)
        if label:
            found.append((path, 0, label))
            continue
        full = os.path.join(root, path)
        if not os.path.isfile(full) or os.path.getsize(full) > MAX_FILE_BYTES:
            continue
        try:
            with open(full, encoding="utf-8") as handle:
                text = handle.read()
        except (UnicodeDecodeError, OSError):
            continue
        found.extend((path, number, kind) for number, kind in scan_text(text))
    return found


def report(findings: Iterable[Finding]) -> int:
    findings = list(findings)
    if not findings:
        print("[secret_scan] ไม่พบค่าลับในส่วนที่ตรวจ")
        return 0
    for path, line, label in findings:
        where = f"{path}:{line}" if line else path
        sys.stderr.write(f"[secret_scan] {where}: {label}\n")
    sys.stderr.write(
        f"[secret_scan] พบ {len(findings)} รายการที่มีลักษณะเป็นค่าลับ กรุณานำค่าออกจากโค้ดและเก็บใน CI/CD variable "
        "หรือที่เก็บค่าลับของโครงการ หากเป็นค่าลับจริงที่เคยถูก push แล้ว ต้องเปลี่ยนค่านั้นใหม่ด้วย "
        "หากเป็นการตรวจพบผิดพลาด ให้ผู้รับผิดชอบปรับบรรทัดนั้นให้ไม่มีลักษณะเป็นค่าลับ\n"
    )
    return 1


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Secret scan of a diff or of the tree")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--base", help="scan the lines added between this commit and HEAD")
    mode.add_argument("--staged", action="store_true", help="scan the staged changes")
    mode.add_argument("--tree", action="store_true", help="scan every tracked file")
    args = parser.parse_args(argv)
    try:
        if args.staged:
            return report(scan_diff(diff_of(None, staged=True)))
        base = args.base or (None if args.tree else os.environ.get("CI_MERGE_REQUEST_DIFF_BASE_SHA"))
        if base:
            print(f"[secret_scan] ตรวจบรรทัดที่เพิ่มตั้งแต่ {base[:12]} ถึง HEAD")
            return report(scan_diff(diff_of(base)))
        print("[secret_scan] ตรวจทุกไฟล์ที่ git ติดตาม")
        return report(scan_tree())
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        sys.stderr.write(f"[secret_scan] ตรวจไม่สำเร็จ: {error}\n")
        return 2


if __name__ == "__main__":
    sys.exit(main())
