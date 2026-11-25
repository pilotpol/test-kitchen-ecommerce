# test-app-

Fullstack PromptServ channel — Next.js with API routes + React UI.

## Features pre-wired

- Keycloak login (BFF) + `<UserMenu/>` + `<ProtectedRoute/>`
- Chat SSE (`/api/chat`) + `<ALEChat/>` demo
- File upload via MinIO presign (`/api/files/*`) + `<FileUploader/>`
- Workflow runner (`/api/workflows/[id]/run`) + `<WorkflowRunner/>`
- Approval queue (`<ApprovalQueue/>`)
- Agent Learning Engine hooks (`useALEMemory`, `useALEScheduler`)
- Inbound webhook (`/api/webhooks/inbound`) with signature verify

## Run

```bash
cp .env.example .env
# fill secrets
./deploy.sh rebuild    # from workspace root
```

Visit `http://localhost:{{PORT}}`.
