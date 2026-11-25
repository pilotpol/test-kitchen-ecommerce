import "server-only";

import { createAdk } from "@repo/adk";
import { decrypt, getCookieFromRequest } from "@repo/auth-bff";

import { authConfig } from "@/lib/auth-config";

/**
 * ADK - the platform's agent-building kit, acting as the signed-in person.
 *
 * Creates and reads agents, workflows, knowledge bases, skills and MCP
 * servers through the platform's own API (PORTAL_API_URL, set at deploy), with
 * the user's token from the session cookie. What a call may do is therefore
 * exactly what that person may do in the portal: a User cannot create an agent
 * here any more than they can on the agent screen.
 *
 * Use it from route handlers:
 *
 *   export async function POST(req: Request) {
 *     const adk = adkForRequest(req);
 *     const agent = await adk.agents.create({ name: "leave-helper", system_prompt: "..." });
 *     return Response.json(agent);
 *   }
 */
export function adkForRequest(req: Request) {
  const portalApiUrl = process.env.PORTAL_API_URL;
  if (!portalApiUrl) throw new Error("PORTAL_API_URL is not set: the platform sets it when the app is deployed");
  // getCookieFromRequest reassembles ps-token.0..n; the cookie is chunked.
  const sealed = getCookieFromRequest(req, "ps-token");
  if (!sealed) throw new Error("not signed in");
  const tokens = JSON.parse(decrypt(sealed, authConfig.cookieSecret)) as { access_token?: string };
  if (!tokens.access_token) throw new Error("not signed in");
  return createAdk({ portalApiUrl, accessToken: tokens.access_token });
}
