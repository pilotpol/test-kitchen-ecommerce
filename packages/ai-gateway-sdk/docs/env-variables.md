# Environment variables

All values are **server-side only** unless prefixed with `NEXT_PUBLIC_`.

## Required

| Variable | Purpose | Example |
|---|---|---|
| `AI_GATEWAY_URL` | Proxy port of ai-gateway | `http://promptserv-ai-gateway:4001` |
| `CHANNEL_API_KEY` | API key of this channel | `ps-ch-xxxxxxxxxxxx` |
| `KEYCLOAK_URL` | Server-to-server Keycloak URL | `http://keycloak:8180` |
| `KEYCLOAK_REALM` | Realm name | `promptserv` |
| `KEYCLOAK_CLIENT_ID` | OIDC client id | `myapp-client` |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret | `***` |
| `KEYCLOAK_REDIRECT_URI` | Callback URL | `http://localhost:3200/api/auth/callback` |
| `COOKIE_SECRET` | AES key for cookie encryption (≥ 16 chars) | `***` |

## Optional

| Variable | Purpose | Default |
|---|---|---|
| `CHANNEL_ID` | Channel UUID for config validation | — |
| `MASTER_KEY` | Admin key — only for ops tooling | — |
| `KEYCLOAK_PUBLIC_URL` | Browser-reachable Keycloak URL | falls back to `KEYCLOAK_URL` |
| `KEYCLOAK_SCOPE` | OIDC scope | `openid email profile` |
| `AUTH_MOCK_MODE` | `true`/`1` bypasses Keycloak | `false` |
| `LINE_CHANNEL_SECRET` | LINE webhook secret (if using LINE) | — |

## Validation

Call `validateEnv()` at app bootstrap — it will throw
`EnvValidationError` with a point-by-point summary when vars are missing
or malformed.

```ts
import { validateEnv } from "@repo/ai-gateway-sdk/config";
const env = validateEnv(); // typed + guaranteed non-null
```
