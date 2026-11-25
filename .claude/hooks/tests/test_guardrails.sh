#!/usr/bin/env bash
# Regression test of the guardrails every Prompt Serve Coder project gets (.claude/hooks/):
# the gate hook pre_bash_guard.py and the feedback hook post_edit_check.py.
# A guardrail that regresses silently is worse than none, because everyone still believes it is
# there: run this after every change to a hook. Needs bash, git and python3. Fake secrets are
# assembled at run time so this file itself never holds one (ci/secret_scan.py scans the tree).
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit 1 # repository root (.claude/hooks/tests -> up 3)
ROOT=$(pwd)
GUARD="$ROOT/.claude/hooks/pre_bash_guard.py"
CHECK="$ROOT/.claude/hooks/post_edit_check.py"

fail=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "PASS: $desc (exit $actual)"
  else
    echo "FAIL: $desc (expected exit $expected, got $actual)"
    fail=1
  fi
}

bash_payload() {
  python3 -c 'import json, sys; print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}, "cwd": sys.argv[2]}))' "$1" "$ROOT"
}
edit_payload() {
  python3 -c 'import json, sys; print(json.dumps({"tool_name": "Write", "tool_input": {"file_path": sys.argv[1]}, "cwd": sys.argv[2]}))' "$1" "$ROOT"
}
guard() { bash_payload "$1" | python3 "$GUARD" > /dev/null 2>&1; }
edited() { edit_payload "$1" | python3 "$CHECK" > /dev/null 2>&1; }

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT
fake_key="AKIA""ABCDEFGHIJKLMNOP"

# --- pre_bash_guard.py (gate) ---
guard "git push origin main"; check "pre_bash_guard blocks push to main" 2 $?
guard "git push origin feat/main-menu"; check "pre_bash_guard allows a work branch" 0 $?
guard "ls -la"; check "pre_bash_guard allows a benign command" 0 $?
echo "not json" | python3 "$GUARD" > /dev/null 2>&1; check "pre_bash_guard fails closed on an unreadable payload" 2 $?

# --- post_edit_check.py (feedback) ---
printf '{"ok": true}\n' > "$SCRATCH/good.json"
edited "$SCRATCH/good.json"; check "post_edit_check passes valid JSON" 0 $?
printf '{"ok": true,}\n' > "$SCRATCH/bad.json"
edited "$SCRATCH/bad.json"; check "post_edit_check reports broken JSON to the agent" 2 $?
printf 'def f(:\n' > "$SCRATCH/bad.py"
edited "$SCRATCH/bad.py"; check "post_edit_check reports Python that does not compile" 2 $?
printf 'aws_key = "%s"\n' "$fake_key" > "$SCRATCH/config.py"
edited "$SCRATCH/config.py"; check "post_edit_check reports a secret in the edited file" 2 $?
printf 'API_KEY=\n' > "$SCRATCH/.env.example"
edited "$SCRATCH/.env.example"; check "post_edit_check allows .env.example" 0 $?
printf 'x\n' > "$SCRATCH/.env"
edited "$SCRATCH/.env"; check "post_edit_check reports a .env file" 2 $?
edited "$SCRATCH/missing.txt"; check "post_edit_check ignores a file that is gone" 0 $?
python3 "$CHECK" "$SCRATCH/good.json" > /dev/null 2>&1; check "post_edit_check as pre-commit passes a good file" 0 $?
python3 "$CHECK" "$SCRATCH/good.json" "$SCRATCH/bad.json" > /dev/null 2>&1; check "post_edit_check as pre-commit fails a bad file" 1 $?

if [ "$fail" -ne 0 ]; then
  echo "guardrail tests failed"
  exit 1
fi
echo "all guardrail tests passed"
