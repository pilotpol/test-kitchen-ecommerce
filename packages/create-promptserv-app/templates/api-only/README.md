# test-app-

Headless PromptServ channel — API routes only.

## Routes

| Path | Purpose |
|---|---|
| `GET /api/auth/login` | Keycloak PKCE login redirect |
| `GET /api/auth/callback` | OIDC callback |
| `GET /api/auth/logout` | Revoke + clear cookie |
| `GET /api/config` | Returns `{ user, access_token }` or 401 |
| `POST /api/chat` | OpenAI-compat chat completions (SSE) |
| `* /api/ale/[...path]` | Agent Learning Engine memory/skills/scheduler proxy |
| `* /api/files/[...path]` | MinIO proxy (presign + direct PUT) |
| `POST /api/workflows/[id]/run` | Workflow run proxy |
| `POST /api/webhooks/{{CHANNEL_TYPE_PATH}}` | Signed webhook receiver |

## Run

```bash
cp .env.example .env
# fill secrets
./deploy.sh rebuild   # from workspace root (Docker)
```

Test:
```bash
curl http://localhost:{{PORT}}/api/config    # → 401 until logged in
curl -X POST http://localhost:{{PORT}}/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
```
