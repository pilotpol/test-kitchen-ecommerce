# ci/ ของ test-app-

สคริปต์ตรวจที่ใช้ทั้งใน CI, ก่อน commit และใน hook ของ agent ใช้ Python 3 standard library เท่านั้น

| ไฟล์ | หน้าที่ |
|---|---|
| `secret_scan.py` | สแกนค่าลับ: `--tree` ทุกไฟล์ที่ git ติดตาม, `--staged` ส่วนที่จะ commit, `--base <sha>` บรรทัดที่เพิ่มหลัง commit นั้น รายการรูปแบบของค่าลับมีที่เดียวคือไฟล์นี้ |
| `tests/` | unit test ของสคริปต์ (`python3 -m unittest discover -s ci/tests -v`) |

hook ของ agent ใน `../.claude/hooks/` นำรายการรูปแบบจาก `secret_scan.py` ไปใช้ จึงตรวจค่าลับตรงกันทุกจุด ทดสอบ hook ด้วย `bash .claude/hooks/tests/test_guardrails.sh`
