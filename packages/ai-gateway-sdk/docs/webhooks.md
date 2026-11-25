# Webhooks — signed inbound routes

Every third-party channel (LINE, Telegram, custom) sends signed events.
The SDK ships a verifier per channel type plus a one-line route factory.

## Supported verifiers

| Channel | Function | Header | Verification |
|---|---|---|---|
| LINE | `verifyLineSignature` | `X-Line-Signature` | Base64 HMAC-SHA256 of raw body with channel secret |
| Telegram | `verifyTelegramSignature` | `X-Telegram-Bot-Api-Secret-Token` | Secret token equality (timing-safe) |
| Generic | `verifyGenericHmac` | configurable (default `X-Signature`) | HMAC (sha1/256/384/512) in hex or base64 |

All comparisons use `timingSafeEqual` — no early-exit side channel.

## Route factory

```ts
// app/api/webhooks/line/route.ts
import { createWebhookRoute } from "@repo/ai-gateway-sdk/webhooks";

export const POST = createWebhookRoute({
  channelType: "line",
  secret: process.env.LINE_CHANNEL_SECRET!,
  onEvent: async ({ parsed, rawBody, headers }) => {
    // `parsed` is JSON-parsed (already verified). `rawBody` is the string.
    for (const ev of parsed.events ?? []) {
      await dispatch(ev);
    }
    return { status: 200, body: { ok: true } };
  },
});
```

Return either a `{ status, body, headers }` object (marshalled to JSON) or
a `Response` directly (when you need a non-JSON reply).

## Why verify in the SDK, not the gateway

1. **Latency** — verify at edge; only real events enter your system.
2. **Decoupling** — each channel's secret lives in the app's env, not in
   gateway config. Scales to many tenants/channels.
3. **Symmetry** — gateway still verifies outbound-to-inbound flows; app
   verifies inbound-from-public-internet. Defense in depth.

## Generic HMAC — common providers

GitHub-style (`sha256=<hex>`):
```ts
createWebhookRoute({
  channelType: "generic",
  secret: process.env.GITHUB_WEBHOOK_SECRET!,
  signatureHeader: "x-hub-signature-256",
  hmacAlgo: "sha256",
  hmacEncoding: "hex",
  signaturePrefix: "sha256=",
  onEvent: async ({ parsed }) => { ... },
});
```

Slack-style (`v0=<hex>` + timestamp — you'll want to also verify the
timestamp isn't replayed):
```ts
createWebhookRoute({
  channelType: "generic",
  secret: process.env.SLACK_SIGNING_SECRET!,
  signatureHeader: "x-slack-signature",
  signaturePrefix: "v0=",
  hmacAlgo: "sha256",
  onEvent: async ({ parsed, headers }) => {
    const ts = headers.get("x-slack-request-timestamp");
    if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) {
      return { status: 401, body: { error: "stale_timestamp" } };
    }
    // ...
  },
});
```

## Dispatching to the gateway

Most channels dispatch to a workflow or agent in the gateway. Pattern:

```ts
import { PromptServClient } from "@repo/ai-gateway-sdk/client";
const client = new PromptServClient({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  auth: { kind: "channel", channelApiKey: process.env.CHANNEL_API_KEY! },
});

export const POST = createWebhookRoute({
  channelType: "line",
  secret: process.env.LINE_CHANNEL_SECRET!,
  onEvent: async ({ parsed }) => {
    const result = await client.workflows.run("wf-line-triage", {
      input: { event: parsed },
    });
    return { status: 200, body: { execution_id: result.execution_id } };
  },
});
```

## Public vs. authenticated

Webhook routes are **public** by definition — the caller is an external
provider, not your user. The middleware's `DEFAULT_WEBHOOK_PATHS` already
excludes `/api/webhooks` so requests aren't bounced to login.

Don't attempt to add Keycloak auth to a webhook route — you'll break the
provider's signature check or just reject valid traffic.

## Rate limiting & idempotency

Out of scope for the SDK. Options:

- Gateway-level rate limit (channel key → budget).
- Idempotency via event IDs (LINE `webhookEventId`, Telegram `update_id`,
  GitHub delivery `X-GitHub-Delivery`).
- Push to a queue (Agent Learning Engine scheduler, external broker) and process async.
