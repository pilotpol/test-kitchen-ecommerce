#!/usr/bin/env python3
"""Claude Code PostToolUse hook: checks a file right after the agent writes it.

The feedback half of the project's guardrails (`pre_bash_guard.py` is the gate half). Wired in
`.claude/settings.json` on Edit, MultiEdit and Write, and run by pre-commit on the staged files
(`.pre-commit-config.yaml`), so the agent hears about a problem in the same turn and a person
hears about it before the commit exists. Regression-tested by `.claude/hooks/tests/test_guardrails.sh`.

What it checks, with the Python 3 standard library only:
  - a line that looks like a secret, by the patterns of `ci/secret_scan.py` (the CI job and the
    commit guard use the same list), or a file that holds secrets by its name
  - JSON that does not parse (`.json`, except the comment-allowing `tsconfig*.json` and `.jsonc`)
  - Python that does not compile

Usage:
  as a hook   Claude Code sends the tool call as JSON on stdin; exit 2 shows stderr to the agent
              so it fixes the file in the same turn, exit 0 says nothing
  as a check  python3 .claude/hooks/post_edit_check.py <file>...; exit 1 when a file fails
"""

from __future__ import annotations

import ast
import json
import os
import sys
from pathlib import Path
from typing import List, Optional

MAX_BYTES = 1_000_000


def secret_scan_module():
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ci"))
    try:
        import secret_scan  # noqa: PLC0415
    except Exception:
        return None
    return secret_scan


def problems(path: Path) -> List[str]:
    found: List[str] = []
    scanner = secret_scan_module()
    if scanner is not None:
        label = scanner.secret_file(path.as_posix())
        if label:
            found.append(f"{path}: {label} ห้ามเก็บไฟล์นี้ใน repository")
    try:
        if not path.is_file() or path.stat().st_size > MAX_BYTES:
            return found
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return found
    if scanner is not None:
        for line, label in scanner.scan_text(text)[:5]:
            found.append(f"{path}:{line}: มีลักษณะเป็นค่าลับ ({label}) ให้อ่านจาก environment variable แทน")
    suffix = path.suffix.lower()
    if suffix == ".json" and not path.name.startswith("tsconfig"):
        try:
            json.loads(text)
        except ValueError as error:
            found.append(f"{path}: JSON ไม่ถูกต้อง ({error})")
    if suffix == ".py":
        try:
            ast.parse(text, filename=str(path))
        except SyntaxError as error:
            found.append(f"{path}:{error.lineno}: Python ไม่ถูกต้อง ({error.msg})")
    return found


def edited_paths(payload: dict) -> List[Path]:
    tool_input = payload.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return []
    name: Optional[str] = tool_input.get("file_path") or tool_input.get("path")
    if not name:
        return []
    path = Path(name)
    if not path.is_absolute():
        path = Path(payload.get("cwd") or os.getcwd()) / path
    return [path]


def main(argv: List[str]) -> int:
    if argv:
        found = [problem for name in argv for problem in problems(Path(name))]
        for problem in found:
            sys.stderr.write(f"[post_edit_check] {problem}\n")
        return 1 if found else 0
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return 0
    found = [
        problem for path in edited_paths(payload if isinstance(payload, dict) else {}) for problem in problems(path)
    ]
    if not found:
        return 0
    sys.stderr.write("[post_edit_check] ไฟล์ที่เพิ่งแก้มีปัญหาที่ต้องแก้ในรอบนี้:\n")
    for problem in found:
        sys.stderr.write(f"  - {problem}\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
