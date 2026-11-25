import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { resetJwksCache, TokenVerificationError, verifyAccessToken } from "../src/verify";
import { claims, config, ecKey, forgedToken, installFakeRealm, rsaKey, signToken } from "./helpers";

const k1 = rsaKey("k1");
const enc = rsaKey("enc1", "enc");
let restore: () => void = () => {};

beforeEach(() => {
  resetJwksCache();
});
afterEach(() => {
  restore();
  mock.restoreAll();
});

async function rejects(p: Promise<unknown>, kind: "invalid" | "unavailable") {
  await assert.rejects(p, (err: unknown) => err instanceof TokenVerificationError && err.kind === kind);
}

test("accepts a token signed by the realm key", async () => {
  ({ restore } = installFakeRealm([k1, enc]));
  const payload = await verifyAccessToken(signToken(k1, claims()), config);
  assert.equal(payload.sub, "user-1");
  assert.deepEqual(payload.realm_access?.roles, ["User_TEST"]);
});

test("accepts ES256", async () => {
  const ec = ecKey("ec1");
  ({ restore } = installFakeRealm([ec]));
  const payload = await verifyAccessToken(signToken(ec, claims()), config);
  assert.equal(payload.sub, "user-1");
});

test("rejects a payload edited after signing (role escalation)", async () => {
  ({ restore } = installFakeRealm([k1]));
  const genuine = signToken(k1, claims());
  const [h, , s] = genuine.split(".");
  const escalated = Buffer.from(JSON.stringify(claims({ realm_access: { roles: ["SuperAdmin"] } }))).toString("base64url");
  await rejects(verifyAccessToken(`${h}.${escalated}.${s}`, config), "invalid");
});

test("rejects an unsigned token sealed into a forged cookie", async () => {
  ({ restore } = installFakeRealm([k1]));
  await rejects(verifyAccessToken(forgedToken(claims()), config), "invalid");
});

test("rejects alg none and HMAC algorithms", async () => {
  ({ restore } = installFakeRealm([k1]));
  const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
  const none = `${Buffer.from(JSON.stringify({ alg: "none", kid: "k1" })).toString("base64url")}.${body}.x`;
  const hs = `${Buffer.from(JSON.stringify({ alg: "HS256", kid: "k1" })).toString("base64url")}.${body}.x`;
  await rejects(verifyAccessToken(none, config), "invalid");
  await rejects(verifyAccessToken(hs, config), "invalid");
});

test("ignores the realm encryption key (use=enc)", async () => {
  ({ restore } = installFakeRealm([k1, enc]));
  const signedWithEnc = signToken({ ...enc, alg: "RS256" }, claims());
  await rejects(verifyAccessToken(signedWithEnc, config), "invalid");
});

test("rejects a token from another realm or another client", async () => {
  ({ restore } = installFakeRealm([k1]));
  await rejects(verifyAccessToken(signToken(k1, claims({ iss: "https://auth.example.test/realms/other" })), config), "invalid");
  await rejects(verifyAccessToken(signToken(k1, claims({ azp: "promptserv-portal" })), config), "invalid");
});

test("does not judge expiry (the session layer refreshes instead)", async () => {
  ({ restore } = installFakeRealm([k1]));
  const payload = await verifyAccessToken(signToken(k1, claims({ exp: 1000 })), config);
  assert.equal(payload.exp, 1000);
});

test("caches the key set and refetches on an unknown kid after the minimum gap", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  let now = 1_000_000;
  mock.method(Date, "now", () => now);

  await verifyAccessToken(signToken(k1, claims()), config);
  await verifyAccessToken(signToken(k1, claims()), config);
  assert.equal(fake.realm.jwksCalls, 1, "second verification uses the cached set");

  // Realm rotates to k2. Within 30 s an unknown kid does not trigger a fetch.
  const k2 = rsaKey("k2");
  fake.realm.keys = [k2];
  await rejects(verifyAccessToken(signToken(k2, claims()), config), "invalid");
  assert.equal(fake.realm.jwksCalls, 1);

  now += 31_000;
  const payload = await verifyAccessToken(signToken(k2, claims()), config);
  assert.equal(payload.sub, "user-1");
  assert.equal(fake.realm.jwksCalls, 2);
});

test("reports unavailable when the key set cannot be fetched", async () => {
  const fake = installFakeRealm([k1]);
  restore = fake.restore;
  fake.realm.jwksDown = true;
  await rejects(verifyAccessToken(signToken(k1, claims()), config), "unavailable");
});
