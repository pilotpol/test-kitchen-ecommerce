# Channels — lifecycle and SDK integration

A **channel** in PromptServ is the binding between:

- **Who** — a Keycloak realm + client (users authorised to use this channel)
- **What** — an entry point (workflow or agent id the channel runs)
- **How** — a channel type (WEB_APP, LINE, TELEGRAM, WEB, IOT, DOCUMENT)
- **Why keys** — a channel API key enforces models/budget/rate-limits

Your app **is** a channel. One app → one channel.

## Type map

| Type | Typical source | Typical entry point |
|---|---|---|
| `WEB_APP` | Your own form/dashboard | Workflow |
| `LINE` | LINE Messaging API | Workflow or agent |
| `TELEGRAM` | Telegram Bot API | Workflow or agent |
| `WEB` | Embeddable widget | Agent |
| `IOT` | Device POST | Workflow |
| `DOCUMENT` | Cron / batch | Document workflow |

## Create a channel

Via AI Gateway admin API (requires master key):

```bash
curl -X POST "$AI_GATEWAY_URL/admin/channels" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "baac-claims-v2",
    "type": "WEB_APP",
    "entry_point_id": "wf-baac-medical-claims"
  }'
```

Response contains `id` + `webhook_urn`. Keep the **channel API key** —
it's shown once:

```bash
curl -X POST "$AI_GATEWAY_URL/admin/channels/$CHANNEL_ID/regenerate-key" \
  -H "Authorization: Bearer $MASTER_KEY"
```

(The CLI `create-promptserv-app` can do this for you when
`PROMPTSERV_MASTER_KEY` + `PROMPTSERV_GATEWAY_URL` env vars are set.)

## Wire the key into your app

```
# .env
CHANNEL_ID=ch_01H...
CHANNEL_API_KEY=ps-ch-xxxxxxxxxxxx
```

Via SDK:

```ts
import { PromptServClient } from "@repo/ai-gateway-sdk/client";

const client = new PromptServClient({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  auth: {
    kind: "channel-user",
    channelApiKey: process.env.CHANNEL_API_KEY!,
    userJwt: accessToken,   // from useSession() / getServerSession()
  },
});
```

## Auth mode picker

| Mode | Use when | Headers |
|---|---|---|
| `channel` | System-to-system (no user context) | `Authorization: Bearer <channel key>` |
| `channel-user` | User-scoped calls from a logged-in user | `X-Channel-Key: <key>` + `Authorization: Bearer <JWT>` |
| `master` | Admin ops (create channel, list users) | `Authorization: Bearer <master key>` |

For user-facing apps, default to `channel-user` so Agent Learning Engine (memory, skills,
scheduler) scopes correctly to the user id in the JWT sub claim.

## Channel permission check

Add `channelId` + `portalApiUrl` to `SdkAuthConfig` and `createConfigHandler`
will enforce that the user has the channel in their `permissions.apps`
list:

```ts
createAuthRoutes({
  ...baseConfig,
  channelId: env.CHANNEL_ID,
  portalApiUrl: env.PORTAL_API_URL,
});
```

Users who aren't authorised get `403 channel_access_denied` at `/api/config`
— the frontend should send them to a "request access" page.

## Rotate a key

When a key is leaked:

```bash
curl -X POST "$AI_GATEWAY_URL/admin/channels/$CHANNEL_ID/regenerate-key" \
  -H "Authorization: Bearer $MASTER_KEY"
```

Then update `CHANNEL_API_KEY` in the app's env and redeploy. Old key is
revoked immediately.

## Registering webhooks with providers

After creating the channel, the gateway returns a `webhook_urn`. For
inbound channels (LINE, Telegram), register that URN **plus** your app's
`/api/webhooks/inbound` route with the provider's admin:

- LINE: Messaging API channel → Webhook URL = `https://your-app/api/webhooks/inbound`
- Telegram: `setWebhook` with `secret_token` = `TELEGRAM_SECRET_TOKEN`

The provider hits **your app** (which verifies the signature), your app
dispatches to **the gateway** (via `client.workflows.run`).

## When to split into multiple channels

- Different SLAs / budgets → separate keys.
- Different user cohorts (internal vs. public) → separate Keycloak clients.
- Different channel types → must be separate channels (type is immutable).

A single app can use multiple channels by instantiating multiple
`PromptServClient` objects with different keys. But the SDK's app-level
helpers (middleware, auth routes, `defineChannelConfig`) assume one-to-one.
