#!/usr/bin/env python3
"""Offline test of ci/secret_scan.py (CI job test:approval-gate-logic runs it with the gate test).

Written for projects made by Prompt Serve Coder; the patterns come from the X10 team's ai-sdlc.
Fake secrets are assembled at run time, so this file never holds one and the tree scan of the
repository stays clean.

Run from the repository root: python3 -m unittest discover -s ci/tests -v
"""

import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import secret_scan  # noqa: E402

AWS = "AKIA" + "ABCDEFGHIJKLMNOP"
GITLAB = "glpat" + "-" + "a1B2c3D4e5F6g7H8i9J0k"
PRIVATE_KEY = "-----BEGIN " + "OPENSSH PRIVATE KEY-----"
ASSIGNMENT = "api_key = '" + "abcd1234efgh5678ijkl" + "'"


class Patterns(unittest.TestCase):
    def test_each_kind_is_found(self):
        for text in (AWS, GITLAB, PRIVATE_KEY, ASSIGNMENT, 'token: "' + "x" * 24 + '"'):
            self.assertTrue(secret_scan.scan_text(text), text[:8])

    def test_ordinary_code_is_not_a_secret(self):
        for text in (
            "task-runner-configuration-for-the-build",
            "password = os.environ['DB_PASSWORD']",
            "headers={'PRIVATE-TOKEN': token}",
        ):
            self.assertEqual(secret_scan.scan_text(text), [], text)

    def test_secret_files_by_name(self):
        self.assertTrue(secret_scan.secret_file(".env"))
        self.assertTrue(secret_scan.secret_file("deploy/.env.production"))
        self.assertTrue(secret_scan.secret_file("certs/server.pem"))
        self.assertIsNone(secret_scan.secret_file(".env.example"))
        self.assertIsNone(secret_scan.secret_file("src/environment.ts"))


class Diffs(unittest.TestCase):
    def test_only_added_lines_count_with_their_line_numbers(self):
        diff = "\n".join(
            [
                "diff --git a/app.py b/app.py",
                "--- a/app.py",
                "+++ b/app.py",
                "@@ -10,0 +11,2 @@",
                "+print('hello')",
                "+KEY = '" + AWS + "'",
                "@@ -20 +21,0 @@",
                "-OLD = '" + AWS + "'",
            ]
        )
        self.assertEqual(secret_scan.scan_diff(diff), [("app.py", 12, "AWS access key ID")])

    def test_an_added_env_file_is_reported(self):
        diff = "diff --git a/.env b/.env\nnew file mode 100644\n--- /dev/null\n+++ b/.env\n@@ -0,0 +1 @@\n+PLAIN=1\n"
        self.assertEqual([path for path, _, _ in secret_scan.scan_diff(diff)], [".env"])

    def test_an_added_line_starting_with_plus_signs_is_content(self):
        diff = "diff --git a/n.md b/n.md\n--- a/n.md\n+++ b/n.md\n@@ -1,0 +2 @@\n+++ " + AWS + "\n"
        self.assertEqual(secret_scan.scan_diff(diff), [("n.md", 2, "AWS access key ID")])


class Repository(unittest.TestCase):
    def test_tree_and_base_modes_on_a_real_repository(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = lambda *args: subprocess.run(
                ["git", "-c", "user.email=t@example.invalid", "-c", "user.name=t", *args],
                cwd=tmp,
                check=True,
                capture_output=True,
            )
            run("init", "-q")
            with open(os.path.join(tmp, "ok.txt"), "w") as handle:
                handle.write("nothing to see\n")
            run("add", "ok.txt")
            run("commit", "-qm", "one")
            base = subprocess.run(
                ["git", "rev-parse", "HEAD"], cwd=tmp, capture_output=True, text=True, check=True
            ).stdout.strip()
            self.assertEqual(secret_scan.scan_tree(tmp), [])
            with open(os.path.join(tmp, "leak.txt"), "w") as handle:
                handle.write("first\n" + AWS + "\n")
            run("add", "leak.txt")
            self.assertEqual(
                secret_scan.scan_diff(secret_scan.diff_of(None, staged=True, cwd=tmp)),
                [("leak.txt", 2, "AWS access key ID")],
            )
            run("commit", "-qm", "two")
            self.assertEqual(
                secret_scan.scan_diff(secret_scan.diff_of(base, cwd=tmp)), [("leak.txt", 2, "AWS access key ID")]
            )
            self.assertEqual(secret_scan.scan_tree(tmp), [("leak.txt", 2, "AWS access key ID")])


if __name__ == "__main__":
    unittest.main()
