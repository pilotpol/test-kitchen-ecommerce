# @repo/adk - PromptServe Agent Development Kit

A thin typed client over the portal-service routes that create the platform's
own objects: agents, workflows, knowledge-base folders, skills and MCP server
registrations. Every call is one request to a route the Portal itself uses,
sent with the signed-in person's access token, so role checks and tenant
guards are the server's and an app can never do more than the person could on
the Portal screens.

Chat, streaming and running workflows from an app are the job of
`@repo/ai-gateway-sdk`. This kit is for building.

```ts
import { createAdk } from "@repo/adk";

// In a route handler: the token comes from the app's own session cookie.
const adk = createAdk({ portalApiUrl: process.env.PORTAL_API_URL!, accessToken: session.jwt });

const agent = await adk.agents.create({
  name: "leave-helper",
  description: "ตอบคำถามระเบียบการลา",
  system_prompt: "ตอบจากเอกสารระเบียบการลาเท่านั้น",
  virtual_key_id: "<vk id>",
});
await adk.agents.bindKnowledgeBase(agent.id, "hr-policies");
```

| Namespace | Calls |
|---|---|
| `agents` | list, get, create, update, remove, bindKnowledgeBase, bindSkill |
| `workflows` | list, get, create, update, remove, run |
| `knowledgeBases` | list, create, remove |
| `skills` | list, get, create, update, remove |
| `mcpServers` | list, get, create, remove, discover |

Errors are `AdkError` with `status` and the server's own `body`.

Tests: `node --experimental-strip-types --test src/__tests__/*.test.ts` (Node 22, no install needed).
