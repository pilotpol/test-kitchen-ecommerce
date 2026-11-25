// node --experimental-strip-types --test src/__tests__/*.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { AdkError, createAdk } from "../index.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(reply: { status?: number; body?: unknown } = {}) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method), headers: init.headers as Record<string, string>, body: init.body as string | undefined });
    const status = reply.status ?? 200;
    const text = reply.body === undefined ? "" : typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test("every call carries the person's token to the portal route", async () => {
  const f = fakeFetch({ body: [{ id: "a1", name: "x" }] });
  const adk = createAdk({ portalApiUrl: "http://portal-service:8080/", accessToken: "tok", fetch: f.fn });
  const agents = await adk.agents.list();
  assert.equal(agents.length, 1);
  assert.equal(f.calls[0]!.url, "http://portal-service:8080/api/v1/agents");
  assert.equal(f.calls[0]!.headers.Authorization, "Bearer tok");
});

test("create agent sends the portal's create shape with defaults the server requires", async () => {
  const f = fakeFetch({ status: 201, body: { id: "a2", name: "hr" } });
  const adk = createAdk({ portalApiUrl: "http://p", accessToken: "t", fetch: f.fn });
  await adk.agents.create({ name: "hr", description: "d", system_prompt: "s", virtual_key_id: "vk" });
  const sent = JSON.parse(f.calls[0]!.body!);
  assert.equal(f.calls[0]!.method, "POST");
  assert.equal(sent.max_iterations, 10);
  assert.equal(sent.virtual_key_id, "vk");
});

test("ids are path-encoded so a value cannot reach another route", async () => {
  const f = fakeFetch({ body: {} });
  const adk = createAdk({ portalApiUrl: "http://p", accessToken: "t", fetch: f.fn });
  await adk.workflows.get("../admin");
  assert.equal(f.calls[0]!.url, "http://p/api/v1/workflows/..%2Fadmin");
});

test("wrapped lists are unwrapped", async () => {
  const f = fakeFetch({ body: { items: [{ id: "s1", name: "k" }] } });
  const adk = createAdk({ portalApiUrl: "http://p", accessToken: "t", fetch: f.fn });
  assert.equal((await adk.skills.list())[0]!.id, "s1");
});

test("a refusal surfaces as AdkError with the status and the server's words", async () => {
  const f = fakeFetch({ status: 403, body: { error: "forbidden" } });
  const adk = createAdk({ portalApiUrl: "http://p", accessToken: "t", fetch: f.fn });
  await assert.rejects(adk.mcpServers.create({ name: "m", url: "http://m" }), (err: unknown) => {
    assert.ok(err instanceof AdkError);
    assert.equal(err.status, 403);
    assert.match(err.body, /forbidden/);
    return true;
  });
});

test("missing configuration fails at construction, not on the first call", () => {
  assert.throws(() => createAdk({ portalApiUrl: "", accessToken: "t" }), /PORTAL_API_URL/);
  assert.throws(() => createAdk({ portalApiUrl: "http://p", accessToken: "" }), /accessToken/);
});
