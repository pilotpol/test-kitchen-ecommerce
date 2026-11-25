import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { requireSession, resetSessionCache, type VerifiedSession } from "../src/session";
import { resetJwksCache } from "../src/verify";
import { claims, config, forgedToken, installFakeRealm, request, rsaKey, sessionCookie, signToken } from "./helpers";

const k1 = rsaKey("k1");
let restore: () => void = () => {};

beforeEach(() => {
  resetJwksCache();
  resetSessionCache();
  delete process.env.AUTH_VERIFY_JWT;
});
afterEach(() => {
  restore();
  delete process.env.AUTH_VERIFY_JWT;
});

async function status(res: VerifiedSession | Response): Promise<[number, string]> {
  assert.ok(res instanceof Response, "expected a denial");
  const body = (await res.json()) as { error: string };
  return [res.status, body.error];
}

test("no cookie: 401 unauthenticated", async () => {
  ({ restore } = installFakeRealm([k1]));
  assert.deepEqual(await status(await requireSession(request(), config)), [401, "unauthenticated"]);
});

test("cookie sealed with another secret: 401 invalid_session", async () => {
  ({ restore } = installFakeRealm([k1]));
  const cookie = sessionCookie({ access_token: signToken(k1, claims()) }, "some-other-secret");
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [401, "invalid_session"]);
});

test("valid session: verified user, token and roles", async () => {
  ({ restore } = installFakeRealm([k1]));
  const token = signToken(k1, claims());
  const s = await requireSession(request(sessionCookie({ access_token: token, refresh_token: "rt" })), config);
  assert.ok(!(s instanceof Response));
  assert.equal(s.user.id, "user-1");
  assert.equal(s.accessToken, token);
  assert.equal(s.refreshed, false);
});

test("forged cookie (leaked cookie secret, self-made SuperAdmin token): 401", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  const cookie = sessionCookie({
    access_token: forgedToken(claims({ realm_access: { roles: ["SuperAdmin"] } })),
    refresh_token: "made-up",
  });
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [401, "invalid_session"]);
  assert.equal(fake.realm.tokenCalls, 1, "a forged token falls through to a refresh, which Keycloak refuses");
});

test("role gate: 403 without the app role, SuperAdmin passes", async () => {
  ({ restore } = installFakeRealm([k1]));
  const noRole = sessionCookie({ access_token: signToken(k1, claims({ realm_access: { roles: ["User"] } })) });
  assert.deepEqual(await status(await requireSession(request(noRole), config)), [403, "insufficient_role"]);

  const opted = await requireSession(request(noRole), config, { enforceRequiredRoles: false });
  assert.ok(!(opted instanceof Response));

  const superAdmin = sessionCookie({ access_token: signToken(k1, claims({ realm_access: { roles: ["SuperAdmin"] } })) });
  assert.ok(!((await requireSession(request(superAdmin), config)) instanceof Response));
});

test("expired token is refreshed at Keycloak once, then served from cache", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  const fresh = signToken(k1, claims({ sub: "user-1" }));
  fake.realm.refreshResult = () => ({ access_token: fresh, refresh_token: "rt2", expires_in: 300, refresh_expires_in: 1800, token_type: "Bearer" });
  const cookie = sessionCookie({ access_token: signToken(k1, claims({ exp: 1000 })), refresh_token: "rt" });

  const a = await requireSession(request(cookie), config);
  assert.ok(!(a instanceof Response));
  assert.equal(a.refreshed, true);
  assert.equal(a.accessToken, fresh);
  const b = await requireSession(request(cookie), config);
  assert.ok(!(b instanceof Response));
  assert.equal(fake.realm.tokenCalls, 1);
});

test("expired token and Keycloak refuses the refresh: 401 session_expired", async () => {
  ({ restore } = installFakeRealm([k1]));
  const cookie = sessionCookie({ access_token: signToken(k1, claims({ exp: 1000 })), refresh_token: "revoked" });
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [401, "session_expired"]);
});

test("Keycloak unreachable during refresh: 503, the user is not logged out", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  fake.realm.tokenDown = true;
  const cookie = sessionCookie({ access_token: signToken(k1, claims({ exp: 1000 })), refresh_token: "rt" });
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [503, "auth_unavailable"]);
});

test("refreshed token fails verification (another client): 401 invalid_session, not 503, not cached", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  fake.realm.refreshResult = () => ({
    access_token: signToken(k1, claims({ azp: "another-client" })),
    refresh_token: "rt2",
    expires_in: 300,
    refresh_expires_in: 1800,
    token_type: "Bearer",
  });
  const cookie = sessionCookie({ access_token: signToken(k1, claims({ exp: 1000 })), refresh_token: "rt" });
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [401, "invalid_session"]);
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [401, "invalid_session"]);
  assert.equal(fake.realm.tokenCalls, 2, "a rejected refresh result must not be cached");
});

test("refreshed token signed with a kid the key set does not hold yet: 401 invalid_session", async () => {
  // The first check fetches the key set; the refreshed token arrives inside
  // the refetch window with an unknown kid, so verify.ts cannot refetch and
  // rejects it as "invalid". That used to surface as 503 auth_unavailable.
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  const k2 = rsaKey("k2");
  fake.realm.refreshResult = () => ({
    access_token: signToken(k2, claims()),
    refresh_token: "rt2",
    expires_in: 300,
    refresh_expires_in: 1800,
    token_type: "Bearer",
  });
  const cookie = sessionCookie({ access_token: signToken(k1, claims({ exp: 1000 })), refresh_token: "rt" });
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [401, "invalid_session"]);
  assert.equal(fake.realm.jwksCalls, 1);
  assert.equal(fake.realm.tokenCalls, 1);
});

test("key set unreachable: 503, never a silent pass", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  fake.realm.jwksDown = true;
  const cookie = sessionCookie({ access_token: signToken(k1, claims()), refresh_token: "rt" });
  assert.deepEqual(await status(await requireSession(request(cookie), config)), [503, "auth_unavailable"]);
});

test("AUTH_VERIFY_JWT=false falls back to decode-only (documented escape hatch)", async () => {
  ({ restore } = installFakeRealm([k1]));
  process.env.AUTH_VERIFY_JWT = "false";
  const cookie = sessionCookie({ access_token: forgedToken(claims()) });
  const s = await requireSession(request(cookie), config);
  assert.ok(!(s instanceof Response));
  assert.equal(s.user.id, "user-1");
});

test("mock mode returns the mock user without touching Keycloak", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  const s = await requireSession(request(), { ...config, mockMode: true });
  assert.ok(!(s instanceof Response));
  assert.ok(s.user.roles.includes("User_TEST"));
  assert.equal(fake.realm.jwksCalls + fake.realm.tokenCalls, 0);
});
