# Migration v0.2 → v0.3 (zero-breaking)

Every v0.2 export is preserved. v0.3 is **additive only** — you don't have
to migrate existing code to upgrade the SDK.

## What you get without changing a line

Bumping `@repo/ai-gateway-sdk` to `0.3.0` gives you access to:

- `@repo/ai-gateway-sdk/auth/keycloak/*` — Keycloak helpers (client + server)
- `@repo/ai-gateway-sdk/webhooks` — signature verifiers + route factory
- `@repo/ai-gateway-sdk/config` — `defineChannelConfig`, `validateEnv`
- `@repo/ai-gateway-sdk/next/middleware` — `withPromptServAuth`, `createFileProxyRoute`
- 4 new hooks (`useChannel`, `useWorkflow`, `useKB`, `useSession`)
- 6 new components (`FileUploader`, `LoginPage`, `ChannelStatus`,
  `ErrorBoundary`, `ApprovalQueue`, `WorkflowRunner`)

## Optional migrations (recommended when touching the file)

### Replace inline auth-bff imports

Before:
```ts
import { createLoginHandler, createCallbackHandler, createConfigHandler, createLogoutHandler } from "@repo/auth-bff";
export const GET_login = createLoginHandler(config, "/dashboard");
export const GET_callback = createCallbackHandler(config, "/dashboard");
export const GET_config = createConfigHandler(config);
export const GET_logout = createLogoutHandler(config);
```

After:
```ts
import { createAuthRoutes } from "@repo/ai-gateway-sdk/auth/keycloak/server";
const routes = createAuthRoutes({ ...config, postLoginPath: "/dashboard" });
export const GET_login = routes.loginGET;
export const GET_callback = routes.callbackGET;
export const GET_config = routes.configGET;
export const GET_logout = routes.logoutGET;
```

### Replace `useAuth` from auth-core with `useSession`

Both work — `useSession` is the SDK-branded ergonomic name.

```ts
// Before
import { useAuth } from "@repo/auth-core";
const { user, accessToken, login, logout } = useAuth();

// After
import { useSession } from "@repo/ai-gateway-sdk/auth/keycloak/client";
const { user, accessToken, login, logout } = useSession();
```

### Consolidate config into `defineChannelConfig`

Instead of scattering `AI_GATEWAY_URL`, `CHANNEL_API_KEY`, `KEYCLOAK_*`
reads across files, put them all in one `lib/channel-config.ts`:

```ts
import { defineChannelConfig, validateEnv } from "@repo/ai-gateway-sdk/config";
const env = validateEnv(); // throws with friendly summary on missing vars
export const channelConfig = defineChannelConfig({
  client: {
    aiGatewayUrl: env.AI_GATEWAY_URL,
    auth: { kind: "channel", channelApiKey: env.CHANNEL_API_KEY },
  },
  auth: {
    keycloakUrl: env.KEYCLOAK_URL,
    realm: env.KEYCLOAK_REALM,
    clientId: env.KEYCLOAK_CLIENT_ID,
    clientSecret: env.KEYCLOAK_CLIENT_SECRET,
    redirectUri: env.KEYCLOAK_REDIRECT_URI,
    cookieSecret: env.COOKIE_SECRET,
  },
  channel: { id: env.CHANNEL_ID!, type: "WEB_APP" },
});
```

## Build pipeline

`tsup.config.ts` now exists. Running `pnpm build` inside the SDK package
emits `dist/` with ESM + CJS + `.d.ts` for every entry. The exports map
still points to `src/` in 0.3.x (so existing consumers don't need to
re-install); 0.4 will flip to `dist/`.

## Nothing is deprecated

No v0.2 API is deprecated. You can keep using:

- `createLoginHandler` etc. directly from `@repo/auth-bff`
- `useAuth` from `@repo/auth-core`
- The original `createPromptServRoute`, `createALEProxyRoute`
- `useWorkflowRun` (the new `useWorkflow` is a composition, not a
  replacement)

Migrate at your own pace.
