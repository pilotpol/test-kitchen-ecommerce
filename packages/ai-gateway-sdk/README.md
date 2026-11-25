# @repo/ai-gateway-sdk

PromptServ Portal-SDK — เครื่องมือสำหรับสร้าง **channel app** ใหม่ที่ plug เข้า
PromptServ core engine (ai-gateway / ale / minio / postgres / keycloak)
โดยไม่ต้อง hand-roll auth, session, webhook verification, หรือ proxy routes
เอง

- **Frontend** (React 19) — `<PromptServAuthProvider/>`, `<LoginButton/>`,
  `<ALEChat/>`, `<FileUploader/>`, `<WorkflowRunner/>`, `<ApprovalQueue/>`
- **Backend** (Next.js API Routes) — `createAuthRoutes`, `createPromptServRoute`,
  `createALEProxyRoute`, `createFileProxyRoute`, `createWebhookRoute`,
  `withPromptServAuth` (middleware), `withAuth` (HOF)
- **Shared** — `PromptServClient` (9 API namespaces), 3 auth modes, zod config

## Install (workspace)

```json
"dependencies": {
  "@repo/ai-gateway-sdk": "workspace:*",
  "@repo/auth-bff": "workspace:*",
  "@repo/auth-core": "workspace:*"
}
```

> **Docker rule:** ห้ามรัน `npm install` หรือ `pnpm install` บน host — ใช้
> `./deploy.sh rebuild <stack>` ที่ workspace root

## Quickstart — fullstack channel app

### 1. Channel config (single source of truth)

```ts
// lib/channel-config.ts
import { defineChannelConfig } from "@repo/ai-gateway-sdk/config";

export const channelConfig = defineChannelConfig({
  client: {
    aiGatewayUrl: process.env.AI_GATEWAY_URL!,
    auth: {
      kind: "channel-user",
      channelApiKey: process.env.CHANNEL_API_KEY!,
      userJwt: "runtime", // replaced per-request on server
    },
  },
  auth: {
    keycloakUrl: process.env.KEYCLOAK_URL!,
    realm: process.env.KEYCLOAK_REALM!,
    clientId: process.env.KEYCLOAK_CLIENT_ID!,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
    redirectUri: process.env.KEYCLOAK_REDIRECT_URI!,
    cookieSecret: process.env.COOKIE_SECRET!,
    postLoginPath: "/dashboard",
  },
  channel: { id: process.env.CHANNEL_ID!, type: "WEB_APP" },
  webhook: {
    channelType: "line",
    secret: process.env.LINE_CHANNEL_SECRET!,
  },
});
```

### 2. Auth routes (one file each, 1 line)

```ts
// app/api/auth/login/route.ts
import { createAuthRoutes } from "@repo/ai-gateway-sdk/auth/keycloak/server";
import { channelConfig } from "@/lib/channel-config";
export const GET = createAuthRoutes(channelConfig.auth).loginGET;

// app/api/auth/callback/route.ts
export const GET = createAuthRoutes(channelConfig.auth).callbackGET;

// app/api/config/route.ts
export const GET = createAuthRoutes(channelConfig.auth).configGET;

// app/api/auth/logout/route.ts
export const GET = createAuthRoutes(channelConfig.auth).logoutGET;
```

### 3. Middleware (auth enforcement)

```ts
// middleware.ts
import { NextResponse } from "next/server";
import { withPromptServAuth } from "@repo/ai-gateway-sdk/next/middleware";

export default withPromptServAuth({ NextResponse });
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
```

### 4. Proxy routes (chat / ale / files)

```ts
// app/api/chat/route.ts
import { createPromptServRoute } from "@repo/ai-gateway-sdk/server";
export const POST = createPromptServRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  channelApiKey: process.env.CHANNEL_API_KEY!,
  forwardUserToken: true,
});

// app/api/ale/[...path]/route.ts
import { createALEProxyRoute } from "@repo/ai-gateway-sdk/server";
const handler = createALEProxyRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  channelApiKey: process.env.CHANNEL_API_KEY!,
});
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;

// app/api/files/[...path]/route.ts
import { createFileProxyRoute } from "@repo/ai-gateway-sdk/next/middleware";
const handler = createFileProxyRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  channelApiKey: process.env.CHANNEL_API_KEY!,
});
export const GET = handler;
export const POST = handler;
```

### 5. Webhook route (LINE example)

```ts
// app/api/webhooks/line/route.ts
import { createWebhookRoute } from "@repo/ai-gateway-sdk/webhooks";
export const POST = createWebhookRoute({
  channelType: "line",
  secret: process.env.LINE_CHANNEL_SECRET!,
  onEvent: async ({ parsed }) => {
    // dispatch, enqueue, forward to gateway…
    return { status: 200, body: { ok: true } };
  },
});
```

### 6. Frontend providers

```tsx
// app/providers.tsx
"use client";
import { PromptServAuthProvider } from "@repo/ai-gateway-sdk/auth/keycloak/client";
import { PromptServClientProvider } from "@repo/ai-gateway-sdk/react-ext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PromptServAuthProvider>
      <PromptServClientProvider
        options={{
          aiGatewayUrl: "/api",
          auth: { kind: "channel", channelApiKey: "proxied-server-side" },
        }}
      >
        {children}
      </PromptServClientProvider>
    </PromptServAuthProvider>
  );
}
```

### 7. Use the components

```tsx
// app/dashboard/page.tsx
import {
  LoginPage,
  FileUploader,
  WorkflowRunner,
  ApprovalQueue,
  ChannelStatus,
  ErrorBoundary,
} from "@repo/ai-gateway-sdk/components";
import { useSession } from "@repo/ai-gateway-sdk/auth/keycloak/client";

export default function DashboardPage() {
  const { user, status } = useSession();
  if (status === "unauthenticated") return <LoginPage />;
  return (
    <ErrorBoundary>
      <ChannelStatus channelId={process.env.NEXT_PUBLIC_CHANNEL_ID!} />
      <FileUploader uploadFn={uploadViaPresign} />
      <WorkflowRunner workflowId="wf-medical-claims" />
      <ApprovalQueue approver={user?.email ?? ""} />
    </ErrorBoundary>
  );
}
```

## Recipes

### API-only (no frontend)

Use `createWebhookRoute`, `createPromptServRoute`, and `PromptServClient`
directly on the server. Skip auth/session — use channel-key auth.

### Frontend-only (SPA)

Still requires a tiny BFF for auth. Run Next.js with only `/api/auth/*`,
`/api/config`, `/api/chat` — skip the pages. Mount a static SPA via
`output: "export"`.

### Fullstack

All 7 steps above.

## Exports

| Path | Purpose |
|---|---|
| `@repo/ai-gateway-sdk` | Barrel — `PromptServClient`, `auth.*`, `webhooks.*`, `config.*` |
| `/client` | `PromptServClient` only |
| `/auth/keycloak` | Server-safe Keycloak helpers |
| `/auth/keycloak/client` | `<PromptServAuthProvider/>`, `useSession`, buttons |
| `/auth/keycloak/server` | `createAuthRoutes`, `getServerSession`, `withAuth` |
| `/webhooks` | Verifiers + `createWebhookRoute` |
| `/config` | `defineChannelConfig`, `validateEnv`, zod schemas |
| `/next/middleware` | `withPromptServAuth`, `createFileProxyRoute` |
| `/server` | `createPromptServRoute`, `createALEProxyRoute` |
| `/next` | `createWorkflowProxyRoute` |
| `/react-ext` | All hooks (`useSession`, `useWorkflow`, `useALEMemory`, ...) |
| `/components` | All drop-in UI components |
| `/types` | Structured types |
| `/errors` | Error hierarchy |

## Docs

- `docs/getting-started.md` — full setup
- `docs/auth.md` — Keycloak realm + client config
- `docs/webhooks.md` — per-channel verifiers
- `docs/channels.md` — channel lifecycle
- `docs/env-variables.md` — env reference
- `docs/migration-v0.2-to-v0.3.md` — zero-breaking migration

## Versioning

SDK follows the Phase calendar of PromptServ core:

- v0.0 chat only
- v0.1 unified client + 8 namespaces
- v0.2 Agent Learning Engine hooks (Phase 5.1.1)
- **v0.3 Portal-SDK — this release (Phase 5.2)**
