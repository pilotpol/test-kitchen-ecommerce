# Changelog

## 0.3.2 - 2026-09-16 (บังคับล็อกอินก่อนเรียก gateway)

ในโหมด channel + JWT กุญแจของช่องทางอยู่ฝั่ง server และถูกแนบให้ทุกคำขอเสมอ ถ้าช่องทาง
นั้นเป็นแบบ anonymous ผู้ที่ยังไม่ได้ล็อกอินก็ถามคำถามและใช้งบของลูกค้าได้ทันทีที่ช่องทาง
เปิด ด่านเดียวที่กั้นอยู่คือสถานะเปิดปิดของช่องทาง ซึ่งเป็นสวิตช์ของรอบทดลองใช้ ไม่ใช่ด่าน
ยืนยันตัวตน ตอนรอบปิดจึงมองไม่เห็นปัญหานี้เลย และมันจะกลับมาพร้อมกันทันทีที่เปิดรอบใหม่

### Added
- `requireUserToken` ใน `createPromptServRoute` ตอบ 401 เมื่อไม่มี `Authorization`
  ก่อนจะยิงไปที่ gateway
- `requireUserJwt` ใน `createALEProxyRoute` ด้วยเหตุผลเดียวกัน

## 0.3.1 - 2026-09-16 (ข้อความปฏิเสธที่ผู้ใช้อ่านรู้เรื่อง)

เส้นทางแชตของ BFF เคยตอบ `Internal Server Error` (500) เมื่อ body ของคำขอไม่ใช่
JSON และตอบ `Gateway Error: {json ดิบของ gateway}` เมื่อช่องทางถูกปิดตามรอบทดลอง
ใช้ ทั้งสองแบบอ่านเหมือนระบบล่ม ทั้งที่ความจริงคือคำขอไม่ถูกรูปแบบ หรือสิทธิ์สิ้นสุด
แล้ว และการส่งข้อความของ gateway ออกไปตรง ๆ ยังเปิดเผยรายละเอียดภายในให้ผู้ที่ยัง
ไม่ได้ล็อกอิน

### Fixed
- `createPromptServRoute` ตอบ 400 พร้อมข้อความว่าคำขอผิดรูปแบบ แทน 500 เมื่อ body
  ไม่ใช่ JSON หรือไม่มีข้อความที่ต้องการถาม
- ช่องทางถูกปิด (gateway 403) ตอบ 403 พร้อมข้อความว่าสิทธิ์การเข้าใช้งานสิ้นสุด
  หรือถูกระงับ แทนการส่ง JSON ของ gateway ออกไป ข้อความจริงของ gateway ถูกเขียน
  ลง log ของแอปแทน
- รหัสอื่นถูกแปลงเป็นข้อความที่อ่านรู้เรื่องเช่นกัน (401 ต้องเข้าสู่ระบบใหม่,
  429 ผู้ใช้งานพร้อมกันจำนวนมาก, อื่น ๆ เป็น 502 ระบบขัดข้องชั่วคราว)

### Added
- `GATEWAY_DENIAL_MESSAGES`, `denialResponse`, `denialFromGatewayStatus` ส่งออกจาก
  `@repo/ai-gateway-sdk/server` เพื่อให้แอปใช้ข้อความชุดเดียวกันได้ รูปแบบคำตอบเป็น
  `{ error: { code, message, type } }` แบบเดียวกับ gateway

## 0.3.0 — 2026-04-17 (Portal-SDK — Phase 5.2)

Turns the SDK into a plug-and-play portal layer for new apps. A new app now
becomes "one channel" by wiring `defineChannelConfig` + `createAuthRoutes` +
`createWebhookRoute` — no bespoke boilerplate for auth/session/MinIO/webhook
verification. Every existing v0.2 export is preserved; 5.2 only ADDS surface.

### Added

- **Keycloak auth module** (`@repo/ai-gateway-sdk/auth/keycloak`)
  - `createAuthRoutes(config)` — one-shot factory returning
    `{ loginGET, callbackGET, configGET, logoutGET }` for `/api/auth/*` and
    `/api/config` route files. Wraps `@repo/auth-bff`.
  - `getServerSession(req, config)` — read & auto-refresh the encrypted
    session cookie from a route handler / RSC.
  - `withAuth(config, handler)` — HOF that 401s when unauthenticated.
  - Client components: `<PromptServAuthProvider/>`, `<LoginButton/>`,
    `<LogoutButton/>`, `<UserMenu/>`, `<ProtectedRoute/>`.
  - Hooks: `useSession()`, `useTokenRefresher()`.

- **Webhook verifiers** (`@repo/ai-gateway-sdk/webhooks`)
  - `verifyLineSignature`, `verifyTelegramSignature`, `verifyGenericHmac`,
    `timingSafeStringEqual` — all Node `crypto`-backed, timing-safe.
  - `createWebhookRoute({ channelType, secret, onEvent })` — Next.js route
    factory that returns 401 on invalid signature, parses JSON on success.

- **Next.js helpers** (`@repo/ai-gateway-sdk/next/middleware`)
  - `withPromptServAuth({ NextResponse, ...opts })` — middleware factory
    with cookie-based session check and public-path matchers.
  - `createFileProxyRoute(config)` — mirror of `createALEProxyRoute`
    for `/v1/files/*` so the channel key never leaks to the browser.
  - `DEFAULT_PUBLIC_PATHS`, `DEFAULT_WEBHOOK_PATHS`, `isPathMatch` matchers.

- **Config validator** (`@repo/ai-gateway-sdk/config`)
  - `defineChannelConfig(input)` — single source of truth; returns typed
    `{ client, auth, channel, webhook? }` validated with zod.
  - `validateEnv(env?)` — parses `process.env` against `EnvSchema`, throws
    `EnvValidationError` with a friendly summary.
  - Zod schemas: `ChannelConfigSchema`, `KeycloakConfigSchema`,
    `WebhookChannelConfigSchema`, `EnvSchema`.

- **Hooks** (`@repo/ai-gateway-sdk/react-ext`)
  - `useChannel(id)` — channel metadata.
  - `useWorkflow({ workflowId })` — definition + run + poll + cancel.
  - `useKB()` — imperative KB search.
  - `useSession()` — re-export from auth module for convenience.

- **Drop-in components** (`@repo/ai-gateway-sdk/components`)
  - `<LoginPage/>`, `<ErrorBoundary/>`, `<ChannelStatus/>`,
    `<ApprovalQueue/>`, `<FileUploader/>`, `<WorkflowRunner/>`.

### Build

- Added `tsup.config.ts` multi-entry config (ESM + CJS + `.d.ts`, no code
  splitting) — `pnpm build` now produces `dist/` ready for publish.
- `package.json` exports map ships new paths (`./auth/keycloak`,
  `./webhooks`, `./config`, `./next/middleware`). Paths still resolve to
  `src/` during the 0.3.x transition; `dist/` flip is deferred to 0.4.

### Dependencies

- Added: `zod ^3.23.8`, `@repo/auth-bff workspace:*`, `tsup ^8.3.5` (dev).
- React moved to `optional` peer — SDK server exports are usable without
  React installed.

### Design guardrails

- **Zero breaking changes** — every v0.2 export preserved.
- Server helpers have no React import.
- Webhook verifiers are framework-agnostic; the route factory is Next.js.
- Middleware injects `NextResponse` from the consumer, avoiding Next runtime
  version coupling.

## 0.1.0 — 2026-04-15 (first real release)

Expanded coverage of the `promptserv-ai-gateway` HTTP surface. The legacy
chat-only exports (`createPromptServRoute`, `sendMessageBFF`, `useAdvancedPromptChat`)
remain for backward compatibility — existing apps (FPO, SPW, prompt-chat) keep working.

### Added

- `PromptServClient` — unified class exposing eight namespaces:
  - `client.chat.completions` — OpenAI-compat chat (stream + non-stream)
  - `client.ocr` — `/v1/ocr/process` with JSON + SSE iteration
  - `client.workflows` — `/admin/workflows/*` CRUD + `run` / `test-run` / `getExecution`
  - `client.approvals` — HITL list / get / decide
  - `client.channels` — CRUD + regenerate key (admin)
  - `client.files` — presign upload/download helpers + direct PUT
  - `client.kb` — knowledge base search
  - `client.traces` — operation events, trace detail, cost breakdown
- `AuthStrategy` — three first-class modes:
  - `channel` (single Bearer)
  - `channel-user` (X-Channel-Key + Bearer JWT dual auth)
  - `master` (admin key)
- Typed error hierarchy: `PromptServError`, `AuthError`, `BudgetExceededError`,
  `RateLimitError`, `ValidationError`, `WorkflowError`, `NetworkError`
- React hooks: `useWorkflowRun`, `useApprovals`, `useFileUpload`, `useOcrStream`
- `PromptServClientProvider` — context provider for the new client
- Next.js factory `createWorkflowProxyRoute` — proxy workflow runs from BFF
- Structured type exports under the `types.*` namespace

### Design guardrails

- No hidden global state — client is dependency-injected
- Retry only on idempotent methods (GET/PUT/DELETE)
- 30s default timeout
- Trace propagation: auto-forward `X-Trace-ID`
- Observability hooks: `onRequest` / `onResponse`
- Strict TypeScript, no `any` in public API

### Migration notes

Legacy imports still work. To migrate an app:

Before:
```ts
import { createPromptServRoute } from "@repo/ai-gateway-sdk/server";
export const POST = createPromptServRoute({...});
```

After (optional — same behavior):
```ts
import { PromptServClient } from "@repo/ai-gateway-sdk/client";
const client = new PromptServClient({
  aiGatewayUrl,
  auth: { kind: "channel-user", channelApiKey, userJwt: token },
});
const stream = await client.chat.completions.createStream({ messages });
return new Response(stream.body, { headers: { "Content-Type": "text/event-stream" }});
```

## 0.0.0

Initial private release — chat completions + SSE streaming only.
