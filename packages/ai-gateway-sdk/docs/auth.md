# Auth — Keycloak (BFF pattern)

The SDK ships a cookie-based BFF (Backend-For-Frontend) flow: tokens live in
an encrypted HttpOnly cookie that only the Next.js server reads. The browser
holds **zero tokens** — so an XSS can't lift them.

## Why BFF over PKCE-SPA

| Concern | BFF (this SDK) | PKCE-SPA (alternative) |
|---|---|---|
| XSS exposure | Tokens unreachable by JS | Tokens in localStorage/memory |
| Refresh storm | Server amortises | Every tab refreshes independently |
| Offline SPA | Needs BFF | Works without server |

We chose BFF because PromptServ apps always run behind a Next.js server
(per the CLAUDE.md deployment model). The `frontend-only` template still
keeps a minimal BFF for `/api/auth/*` + `/api/config`.

## Keycloak realm setup

In Keycloak admin:

1. Use the existing realm (e.g. `promptserv`) or create one.
2. Create a **confidential** client (Client authentication = on):
   - Client ID = `<your-app>-client`
   - Client secret = copy into `KEYCLOAK_CLIENT_SECRET`
   - Valid redirect URIs = `http://localhost:<port>/api/auth/callback`,
     `https://<your-domain>/api/auth/callback`
   - Web origins = same origins as above
3. Roles — if you use `permissions.apps` channel gating, also register the
   user with the channel in portal-service (`/admin/users`).

## The 4 routes

```ts
// app/api/auth/login/route.ts
import { createAuthRoutes } from "@repo/ai-gateway-sdk/auth/keycloak/server";
import { authRoutesConfig } from "@/lib/channel-config";
export const GET = createAuthRoutes(authRoutesConfig).loginGET;

// app/api/auth/callback/route.ts
export const GET = createAuthRoutes(authRoutesConfig).callbackGET;

// app/api/auth/logout/route.ts
export const GET = createAuthRoutes(authRoutesConfig).logoutGET;

// app/api/config/route.ts
export const GET = createAuthRoutes(authRoutesConfig).configGET;
```

`createAuthRoutes` takes an `SdkAuthConfig`:

```ts
interface SdkAuthConfig {
  keycloakUrl: string;           // server-to-server
  keycloakPublicUrl?: string;    // browser redirects
  realm: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  cookieSecret: string;          // ≥ 16 chars
  scope?: string;                // default "openid email profile"
  mockMode?: boolean;            // dev-only
  postLoginPath?: string;        // default "/"
  channelId?: string;            // enables channel permission check
  portalApiUrl?: string;         // required when channelId is set
}
```

## Middleware

Add `middleware.ts` at the app root:

```ts
import { NextResponse } from "next/server";
import { withPromptServAuth } from "@repo/ai-gateway-sdk/next/middleware";

export default withPromptServAuth({ NextResponse });
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};
```

Public paths (auth endpoints, webhooks, favicon, `/_next/*`) bypass the
check automatically. API routes return `401` JSON; pages redirect to
`/login`.

## React side

```tsx
import {
  PromptServAuthProvider,
  useSession,
  LoginButton,
  UserMenu,
  ProtectedRoute,
} from "@repo/ai-gateway-sdk/auth/keycloak/client";

function App() {
  const { user, status, accessToken } = useSession();
  if (status === "unauthenticated") return <LoginButton/>;
  return <ProtectedRoute>... <UserMenu/> ...</ProtectedRoute>;
}
```

`useSession` fetches `/api/config` once on mount and exposes the user +
access token. The token auto-refreshes on each `/api/config` hit — use
`useTokenRefresher()` to nudge it silently before the 5-minute expiry:

```tsx
import { useTokenRefresher } from "@repo/ai-gateway-sdk/auth/keycloak/client";
// somewhere inside <AuthProvider>:
useTokenRefresher({ intervalMs: 4 * 60 * 1000 });
```

## Server-side

Route handlers / server actions:

```ts
import { withAuth, getServerSession } from "@repo/ai-gateway-sdk/auth/keycloak/server";

export const GET = withAuth(authRoutesConfig, async (_req, { user, session }) => {
  return Response.json({ user, token: session.accessToken });
});
```

## Mock mode

For local dev without Keycloak:

```
AUTH_MOCK_MODE=true
```

`/api/config` returns a fake admin user (`admin@promptserv.local`) and a
fake access token. All downstream guards (`withAuth`, middleware, UserMenu)
still behave correctly — just with the mock identity.

## Things the SDK does NOT do

- Does not issue JWTs directly (Keycloak is the IDP).
- Does not manage Keycloak realms/clients (use Keycloak admin UI or Terraform).
- Does not implement client-side PKCE — BFF only. If you truly need a pure
  SPA, parked for a future phase.
