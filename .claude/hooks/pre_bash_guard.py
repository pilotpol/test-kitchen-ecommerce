#!/usr/bin/env python3
"""Claude Code PreToolUse hook for Bash: no push to a protected branch, no secret in a commit.

Adapted from the X10 team's ai-sdlc (`.claude/hooks/pre_bash_guard.py`, approval gate config
section 4) for projects made by Prompt Serve Coder. It is wired in `.claude/settings.json` and
regression-tested by `.claude/hooks/tests/test_hooks.sh`, which CI runs in job `test:hooks`.

Claude Code sends the tool call as JSON on stdin. Exit 0 allows the command, exit 2 blocks it and
shows stderr to the agent (exit 1 would only warn, so a guardrail must use 2).

What it blocks:
  - `git push` whose destination is a protected branch (`main`, `HEAD:main`, `+main`, `:main`,
    `refs/heads/main`), a bare `git push` while the current branch is protected, and
    `--all`/`--mirror`. A branch whose name merely contains the word, such as `feat/main-menu`,
    is allowed. All merges into a protected branch go through a merge request and the approval
    gate of `ci/check_mr_approval_gate.py`.
  - `git commit` when the staged changes (and, with `-a`, the tracked changes) add a line that
    looks like a secret or add a file that holds secrets by its name. The patterns are those of
    `ci/secret_scan.py`, the same list the CI job `gate:secret-scan` uses.
  - a payload it cannot read: a guardrail fails closed.

Adjust PROTECTED_BRANCHES to the branch convention of the project. Whoever is blocked by a false
positive reports it to a person; weakening this hook or its wiring is not a workaround.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

PROTECTED_BRANCHES = {"main", "master", "production", "prod"}

SEPARATORS = {"&&", "||", ";", "|", "&", ";;", "|&"}
# git push options that take the next argument as their value.
PUSH_VALUE_OPTIONS = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
# git global options that take the next argument as their value.
GIT_VALUE_OPTIONS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}


def block(reason: str) -> None:
    sys.stderr.write(f"[pre_bash_guard] BLOCKED: {reason}\n")
    sys.exit(2)


def read_payload() -> dict:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        block("อ่านข้อมูลคำสั่งที่ Claude Code ส่งมาไม่ได้ จึงปิดกั้นไว้ก่อนตามหลัก fail closed")
    return payload if isinstance(payload, dict) else {}


def segments(command: str) -> List[List[str]]:
    """The simple commands of a shell line, split at `&&`, `||`, `;`, `|` and new lines."""
    text = command.replace("\r", " ").replace("\n", " ; ")
    try:
        lexer = shlex.shlex(text, posix=True, punctuation_chars=";&|")
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:
        tokens = text.split()
    result: List[List[str]] = [[]]
    for token in tokens:
        if token in SEPARATORS:
            result.append([])
        else:
            result[-1].append(token)
    return [segment for segment in result if segment]


def git_call(segment: List[str], cwd: str) -> Optional[Tuple[str, List[str], str]]:
    """(subcommand, its arguments, the directory it runs in) when the segment runs git."""
    index = 0
    while index < len(segment) and (
        "=" in segment[index]
        and not segment[index].startswith("-")
        or segment[index] in ("command", "env", "sudo", "exec", "time", "nohup")
    ):
        index += 1
    if index >= len(segment) or os.path.basename(segment[index]) != "git":
        return None
    index += 1
    directory = cwd
    while index < len(segment) and segment[index].startswith("-"):
        option = segment[index]
        if option == "-C" and index + 1 < len(segment):
            directory = os.path.join(directory, segment[index + 1])
            index += 2
        elif option in GIT_VALUE_OPTIONS and index + 1 < len(segment):
            index += 2
        else:
            index += 1
    if index >= len(segment):
        return None
    return segment[index], segment[index + 1 :], directory


def current_branch(cwd: str) -> Optional[str]:
    try:
        result = subprocess.run(
            ["git", "symbolic-ref", "--quiet", "--short", "HEAD"], cwd=cwd, capture_output=True, text=True, timeout=10
        )
    except Exception:
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def branch_name(ref: str) -> str:
    for prefix in ("refs/heads/", "heads/"):
        if ref.startswith(prefix):
            return ref[len(prefix) :]
    return ref


def check_push(args: List[str], cwd: str) -> None:
    positional: List[str] = []
    index = 0
    while index < len(args):
        arg = args[index]
        if arg in ("--all", "--mirror"):
            block(f"'git push {arg}' ส่งทุก branch รวมถึง branch ที่ป้องกันไว้ ให้ push เฉพาะ branch ของงานแล้วเปิด merge request")
        if arg in PUSH_VALUE_OPTIONS:
            index += 2
            continue
        if arg.startswith("-"):
            index += 1
            continue
        positional.append(arg)
        index += 1
    refspecs = positional[1:]
    if not refspecs:
        branch = current_branch(cwd)
        if branch in PROTECTED_BRANCHES:
            block(
                f"'git push' จาก branch '{branch}' ซึ่งเป็น branch ที่ป้องกันไว้ ให้สร้าง branch ของงาน push แล้วเปิด merge request"
            )
        return
    for spec in refspecs:
        spec = spec.lstrip("+")
        destination = spec.split(":", 1)[1] if ":" in spec else spec
        if destination == "HEAD" or destination == "":
            destination = current_branch(cwd) or ""
        name = branch_name(destination)
        if name in PROTECTED_BRANCHES:
            block(
                f"'git push' ไปยัง branch '{name}' ที่ป้องกันไว้ไม่อนุญาตใน session ของ agent "
                f"การรวมงานเข้า {name} ต้องผ่าน merge request และ approval gate ตามบทบาท (ci/check_mr_approval_gate.py)"
            )


def secret_scan_module():
    sys.dont_write_bytecode = True  # no __pycache__ left in ci/ by an agent's commit
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ci"))
    try:
        import secret_scan  # noqa: PLC0415
    except Exception:
        return None
    return secret_scan


def commits_all(arg: str) -> bool:
    """`-a`, `--all` or a cluster of short flags such as `-am` that holds `a` before a value."""
    if arg in ("-a", "--all"):
        return True
    if not arg.startswith("-") or arg.startswith("--"):
        return False
    for flag in arg[1:]:
        if flag == "a":
            return True
        if flag in "mFCctS":
            return False
    return False


def check_commit(args: List[str], cwd: str) -> None:
    scanner = secret_scan_module()
    if scanner is None:
        block("ไม่พบ ci/secret_scan.py จึงตรวจค่าลับก่อน commit ไม่ได้ ปิดกั้นไว้ก่อนตามหลัก fail closed")
    everything = any(commits_all(arg) for arg in args)
    try:
        diffs = [scanner.diff_of(None, staged=True, cwd=cwd)]
        if everything:
            diffs.append(scanner.git(["diff", "--no-color", "--no-ext-diff", "--unified=0", "--no-renames"], cwd))
    except Exception as error:
        sys.stderr.write(f"[pre_bash_guard] WARNING: อ่าน diff ไม่สำเร็จ ({error}) จึงข้ามการตรวจค่าลับ\n")
        return
    findings = [finding for diff in diffs for finding in scanner.scan_diff(diff)]
    if findings:
        where = ", ".join(f"{path}:{line}" if line else path for path, line, _ in findings[:5])
        kinds = ", ".join(sorted({label for _, _, label in findings}))
        block(
            f"ส่วนที่จะ commit มีลักษณะเป็นค่าลับ ({kinds}) ที่ {where} "
            "นำค่าออกและอ่านจาก environment variable หรือที่เก็บค่าลับของโครงการแทน "
            "หากเป็นการตรวจพบผิดพลาด ให้ผู้รับผิดชอบตรวจและ commit เอง"
        )


def main() -> None:
    payload = read_payload()
    tool_input = payload.get("tool_input") or {}
    command = (tool_input.get("command") or "") if isinstance(tool_input, dict) else ""
    cwd = payload.get("cwd") or os.getcwd()
    for segment in segments(command):
        if segment[0] == "cd" and len(segment) > 1:
            cwd = os.path.join(cwd, os.path.expanduser(segment[1]))
            continue
        call = git_call(segment, cwd)
        if call is None:
            continue
        subcommand, args, directory = call
        if subcommand == "push":
            check_push(args, directory)
        elif subcommand == "commit":
            check_commit(args, directory)
    sys.exit(0)


if __name__ == "__main__":
    main()
