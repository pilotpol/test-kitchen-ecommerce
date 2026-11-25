"""Signatures the Go gateway produced, pinned here.

The gateway signs and this SDK verifies, in different languages, and nothing
in either test suite would notice them drifting apart: the Go tests check Go
against Go, the Python tests check Python against Python, and both keep passing
while every real delivery fails. These vectors are the only thing that fails
when one side changes.

They came from internal/callback.Sign. The matching Go test asserts the same
values, so whichever side is edited is the side that goes red.

The third vector is Thai in both the secret and the body: signing is over
bytes, and a change that encoded either as anything but UTF-8 would still pass
every ASCII case.
"""

from promptserv.webhooks import sign

VECTORS = [
    (
        "topsecret",
        "1787067279",
        '{"agent_execution_id":"exec-1","status":"completed"}',
        "sha256=7bdd5418cdeb5cb57e882f4bf6f5041b357f584d0de9cba62aaa8158ed62c569",
    ),
    (
        "s3cr3t",
        "1",
        "{}",
        "sha256=48be129bcc3f8c72d7dead428290dc909e98a2206bab064a5e692cf8acd87936",
    ),
    (
        "ยาว-secret",
        "1700000000",
        '{"output":"สวัสดีครับ"}',
        "sha256=2013093a7a01cc8360ee3eef177070e8644b4dd183d9e6e4054ff81ae6cb42b3",
    ),
]


def test_python_agrees_with_the_gateway():
    for secret, ts, body, expected in VECTORS:
        assert sign(secret, ts, body.encode()) == expected, (
            f"signature drifted for ts={ts}: this SDK would reject every "
            f"callback the gateway sends"
        )
