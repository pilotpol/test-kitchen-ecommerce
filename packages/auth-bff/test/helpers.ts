/**
 * Test fixtures: a fake Keycloak realm (signing keys + JWKS + token endpoint)
 * and helpers to build session cookies the way the callback handler does.
 */
import { createSign, generateKeyPairSync, sign as cryptoSign, type KeyObject } from "node:crypto";

import { buildChunkedSetCookies } from "../src/cookie";
import { encrypt } from "../src/crypto";
import type { AuthConfig } from "../src/types";

export const config: AuthConfig = {
  keycloakUrl: "http://kc.test",
  realm: "promptserv",
  clientId: "promptserv-chat",
  clientSecret: "client-secret",
  redirectUri: "http://app.test/api/auth/callback",
  cookieSecret: "cookie-secret-for-tests",
  requiredRoles: ["User_TEST"],
};

export const ISSUER = "https://auth.example.test/realms/promptserv";

export interface SigningKey {
  kid: string;
  alg: string;
  privateKey: KeyObject;
  jwk: Record<string, unknown>;
}

export function rsaKey(kid: string, use = "sig"): SigningKey {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: use === "sig" ? "RS256" : "RSA-OAEP", use };
  return { kid, alg: "RS256", privateKey, jwk };
}

export function ecKey(kid: string): SigningKey {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  return { kid, alg: "ES256", privateKey, jwk };
}

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

export function claims(over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "user-1",
    preferred_username: "user1",
    email: "user1@example.test",
    name: "User One",
    iss: ISSUER,
    azp: "promptserv-chat",
    iat: now,
    exp: now + 300,
    realm_access: { roles: ["User_TEST"] },
    ...over,
  };
}

export function signToken(key: SigningKey, payload: Record<string, unknown>, headerOver: Record<string, unknown> = {}): string {
  const header = { alg: key.alg, typ: "JWT", kid: key.kid, ...headerOver };
  const input = `${b64(header)}.${b64(payload)}`;
  let sig: Buffer;
  if (key.alg === "ES256") {
    sig = cryptoSign("sha256", Buffer.from(input), { key: key.privateKey, dsaEncoding: "ieee-p1363" });
  } else {
    const s = createSign("RSA-SHA256");
    s.update(input);
    sig = s.sign(key.privateKey);
  }
  return `${input}.${sig.toString("base64url")}`;
}

/** A token that looks right but carries no valid signature. */
export function forgedToken(payload: Record<string, unknown>, kid = "k1"): string {
  return `${b64({ alg: "RS256", typ: "JWT", kid })}.${b64(payload)}.${Buffer.from("not-a-signature").toString("base64url")}`;
}

/** Cookie header carrying a session, chunked exactly as the callback writes it. */
export function sessionCookie(tokens: Record<string, unknown>, secret = config.cookieSecret): string {
  const sealed = encrypt(JSON.stringify(tokens), secret);
  return buildChunkedSetCookies("ps-token", sealed)
    .map((sc) => sc.split(";")[0] ?? "")
    .filter((kv) => !kv.endsWith("="))
    .join("; ");
}

export function request(cookie?: string): Request {
  return new Request("http://app.test/api/x", { headers: cookie ? { cookie } : {} });
}

export interface FakeRealm {
  keys: SigningKey[];
  jwksCalls: number;
  tokenCalls: number;
  jwksDown: boolean;
  tokenDown: boolean;
  /** What the token endpoint returns for a refresh; null = 400 invalid_grant. */
  refreshResult: (() => Record<string, unknown>) | null;
}

/** Replace global fetch with a fake Keycloak. Returns the realm and a restore fn. */
export function installFakeRealm(keys: SigningKey[]): { realm: FakeRealm; restore: () => void } {
  const realm: FakeRealm = { keys, jwksCalls: 0, tokenCalls: 0, jwksDown: false, tokenDown: false, refreshResult: null };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/protocol/openid-connect/certs")) {
      realm.jwksCalls++;
      if (realm.jwksDown) throw new Error("connect ECONNREFUSED");
      return Response.json({ keys: realm.keys.map((k) => k.jwk) });
    }
    if (url.endsWith("/protocol/openid-connect/token")) {
      realm.tokenCalls++;
      if (realm.tokenDown) throw new TypeError("fetch failed");
      if (!realm.refreshResult) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json(realm.refreshResult());
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { realm, restore: () => { globalThis.fetch = original; } };
}
