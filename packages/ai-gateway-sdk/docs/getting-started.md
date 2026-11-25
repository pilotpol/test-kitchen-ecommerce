# Getting started

Two paths — pick one.

## Path A: Scaffold a new channel app (recommended)

```bash
# From workspace root
pnpm create promptserv-app apps/my-new-channel
```

Answer the prompts:

1. **App name** — kebab-case (e.g. `baac-claims-v2`)
2. **Template** — `fullstack`, `api-only`, or `frontend-only`
3. **Channel type** — `WEB_APP`, `LINE`, `TELEGRAM`, `WEB`, `IOT`, `DOCUMENT`
4. **Channel ID** — paste if you already created the channel, else empty
5. **Keycloak client ID** — defaults to `<app-name>-client`
6. **Dev port** — default depends on template
7. **Webhook route?** — auto-skipped for `WEB_APP`
8. **Initialize git?** — default yes

Then:

```bash
cd apps/my-new-channel
cp .env.example .env
# fill: CHANNEL_API_KEY, KEYCLOAK_CLIENT_SECRET, COOKIE_SECRET, ...
./deploy.sh rebuild      # from workspace root
```

Visit `http://localhost:<port>`.

## Path B: Add SDK to an existing app

```json
// package.json
"dependencies": {
  "@repo/ai-gateway-sdk": "workspace:*",
  "@repo/auth-bff": "workspace:*",
  "@repo/auth-core": "workspace:*"
}
```

Wire the 4 auth routes + `middleware.ts` as shown in the root README.
See [auth.md](./auth.md) for Keycloak setup, [webhooks.md](./webhooks.md) for
signed webhooks, [channels.md](./channels.md) for registering your channel in
the gateway.

## Mental model

A PromptServ app is **one channel**. Each channel has:

- A **channel key** (server-only — never ship to browser)
- An **entry point** (workflow or agent in the gateway)
- An **auth scope** (Keycloak client + user permissions on the channel)
- Optionally a **webhook URN** (inbound events from LINE, Telegram, ...)

The SDK is the glue between your code and the PromptServ core engine.
Everything else — the AI Gateway, Agent Learning Engine sidecar, MinIO, Keycloak,
Postgres — is behind `client.*` calls or route factories.

## What's included vs. what you still write

| Included | You still write |
|---|---|
| Keycloak BFF (login, callback, logout, config, refresh) | Business logic for `/api/workflows/*` run inputs |
| Middleware for auth enforcement | Copy changes, branding, theme |
| Webhook signature verification | Event handler in `onEvent` (dispatch, enqueue, queue transform) |
| MinIO presigned upload (direct PUT) | Business metadata about uploaded files |
| Agent Learning Engine memory/skills/scheduler proxy | Domain prompts and workflow definitions |
| React hooks + drop-in UI | Custom components if you outgrow the drop-ins |

## Troubleshooting

- **`Cannot find module '@repo/...'`** — the workspace wasn't installed yet;
  run `./deploy.sh rebuild` (Docker). `pnpm install` on host is forbidden per
  workspace CLAUDE.md.
- **`401 invalid_session` in a browser** — check that `/api/config` is
  reachable at the same origin and that the middleware isn't stripping the
  `ps-token` cookie.
- **`invalid_signature` on a webhook** — see [webhooks.md](./webhooks.md) for
  per-channel-type header names (LINE: `x-line-signature`, Telegram:
  `x-telegram-bot-api-secret-token`).
