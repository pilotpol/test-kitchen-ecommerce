# PromptServ AI Channel App Template

Agent Learning Engine-aware Next.js skeleton for tenant apps connected to the PromptServ AI Gateway.

## Architecture

```
Browser ──► Next.js BFF ──► AI Gateway (4000) ──► LLM Provider
              │                  │
              │                  ├──► Agent Learning Engine Sidecar (8765)
              │                  │     memory + skills + scheduler
              │                  ▼
              │            /v1/chat/completions
              │            /v1/ale/* (user-scoped, JWT)
              │
              └─► Keycloak OIDC (HttpOnly cookies)
```

## Quick Start

```bash
cp .env.example .env.local       # fill in Keycloak + channel key
pnpm install
pnpm dev                          # starts on http://localhost:3009
```

Open [http://localhost:3009](http://localhost:3009).

## Examples (reference only)

The example pages are not part of a new app's workspace. In a Create AI App
session they are readable at `/opt/promptserve/reference/examples/<name>/page.tsx`;
in the monorepo they live in `apps/_ai-template/app/examples`.

| Path                       | Component / Hook                       | Use case                              |
|----------------------------|----------------------------------------|---------------------------------------|
| `/examples/chat`           | `<ALEChat />`                       | Drop-in chat with memory recall + skill discovery |
| `/examples/memory`         | `useALEMemory` + `<MemoryDrawer />` | List + delete user-scoped memory      |
| `/examples/ocr-extract`    | `<DocumentReviewSplit />`              | OCR review pattern (forms, receipts) |
| `/examples/workflow`       | `<ApprovalCard />`                     | HITL workflow approval inbox          |

Each example is **one page**. Copy what you need into your own app.

## Standard building blocks (deployed apps)

Every app created from Create AI App gets the same four pieces. Use them; do not
write another HTTP client, database layer or credential store.

| Piece | Use it through | What the platform provides at deploy |
|-------|----------------|--------------------------------------|
| SDK `@repo/ai-gateway-sdk` | `lib/gateway-client.ts`, `app/api/chat` | `CHANNEL_API_KEY` of the app's own channel, `AI_GATEWAY_URL` |
| ADK `@repo/adk` | `lib/adk.ts` (`adkForRequest(req)`) | `PORTAL_API_URL`; calls act as the signed-in user |
| Database (PostgreSQL) | `lib/db.ts` (`query(text, params)`) | `DATABASE_URL`: one login + one schema per app, password rotated each deploy |
| Platform MCP | the build engine's own tools while the app is being written | acts as the person who opened the Create AI App chat |

The app is served at `https://<slug>.apps.<domain>` as soon as the deploy's
health check passes, with a memory and CPU ceiling per app container.

## Auth Modes

- **Channel + JWT (recommended)** - set `CHANNEL_API_KEY`. App sends `X-Channel-Key` + Bearer JWT; gateway resolves model from VirtualKey.
- **Mock** - set `AUTH_MOCK=true` to bypass Keycloak (dev only).

## Agent Learning Engine integration

Two BFF routes are wired:

1. **`/api/chat`** - chat completions proxy (uses `createPromptServRoute`).
2. **`/api/ale/[...path]`** - user-scoped admin proxy (uses `createALEProxyRoute`). Reads Keycloak JWT from the encrypted `ps-token` cookie and forwards as Bearer to the gateway's `/v1/ale/*` endpoints.

Browser-side, [`lib/gateway-client.ts`](lib/gateway-client.ts) returns a `PromptServClient` pointed at the same origin so cookies flow naturally and the channel key never reaches the browser.

The SDK's Agent Learning Engine namespace (`client.ale.memory`, `client.ale.skills`, `client.ale.scheduler`) and React hooks (`useALEMemory`, `useALESkills`, `useALEScheduler`) call this BFF transparently - no app code touches the gateway directly.

## Creating a new app from the template

```bash
cp -r apps/_ai-template apps/my-new-app
cd apps/my-new-app

# 1. package.json - change "name" + dev port
# 2. lib/auth-config.ts - update redirectUri port if needed
# 3. .env.local - set CHANNEL_API_KEY, AI_GATEWAY_URL, Keycloak vars
# 4. Replace app/page.tsx with your business landing
# 5. Add modules under app/(routes)/
# 6. Register the app in apps/hub/app/ai-workspace/page.tsx
```

The shared `@repo/ai-gateway-sdk` (v0.2+) gives every app these capabilities for free:

| Capability                              | Where                              |
|-----------------------------------------|------------------------------------|
| Channel + JWT auth                      | `createPromptServRoute`            |
| User-scoped Agent Learning Engine admin (memory etc.)  | `createALEProxyRoute` + `client.ale.*` |
| Streaming chat with steps + thinking    | `useAdvancedPromptChat`            |
| File upload                             | `useFileUpload`                    |
| OCR streaming                           | `useOcrStream`                     |
| Workflow execution + polling            | `useWorkflowRun`                   |
| HITL approvals                          | `useApprovals` + `<ApprovalCard />` |

## Project structure

```
app/
  api/
    auth/{login,callback,logout}/route.ts   ← Keycloak OIDC BFF
    config/route.ts                          ← Auth + channel permission check
    chat/route.ts                            ← Chat completions proxy
    ale/[...path]/route.ts                ← User-scoped Agent Learning Engine admin proxy (NEW)
  examples/
    chat/page.tsx                            ← <ALEChat /> demo
    memory/page.tsx                          ← Memory list + drawer
    ocr-extract/page.tsx                     ← <DocumentReviewSplit />
    workflow/page.tsx                        ← <ApprovalCard />
  layout.tsx                                 ← AuthProvider wrapper
  page.tsx                                   ← Landing - links to examples
lib/
  auth-config.ts                             ← Keycloak OIDC config
  gateway-client.ts                          ← Browser PromptServClient singleton (NEW)
```

## Shared packages

| Package | Purpose |
|---------|---------|
| `@repo/auth-bff` | Keycloak OIDC BFF handler factories + cookie crypto |
| `@repo/auth-core` | React `AuthProvider` + `useAuth` hook |
| `@repo/ai-gateway-sdk` | Unified client + Agent Learning Engine namespace + hooks + drop-in components |
| `@repo/core-ui` | Shared Tailwind styles |
