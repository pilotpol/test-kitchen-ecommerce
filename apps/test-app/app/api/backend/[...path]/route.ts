import { decodeJwt } from "@repo/auth-bff";
import { withAuth } from "@repo/ai-gateway-sdk/auth/keycloak/server";

import { authConfig } from "@/lib/auth-config";
import { backendUrl } from "@/lib/backend";

/*
 * The only way the browser reaches the Go backend (backend/).
 *
 * withAuth reads the encrypted session cookie and answers 401 without one,
 * so the backend is never called for somebody who is not signed in. The
 * backend listens on 127.0.0.1 inside the same container; it learns who is
 * asking from X-PS-User and X-PS-Roles, set here from the verified token.
 * Cookies and the Authorization header are not forwarded.
 *
 * Do not call the backend from client code directly, and do not remove this file.
 */
const FORWARDED = ["content-type", "accept", "accept-language"];

type Session = { accessToken: string; user: { id: string; email: string; roles: string[] } };

/** The PromptServe username (preferred_username) the backend keys its rows by. */
function usernameOf(session: Session): string {
  try {
    const claims = decodeJwt(session.accessToken) as unknown as { preferred_username?: string };
    if (claims?.preferred_username) return claims.preferred_username;
  } catch {
    // AUTH_MOCK=true in local development carries no real token.
  }
  return session.user.email || session.user.id;
}

async function forward(req: Request, session: Session, path: string[]): Promise<Response> {
  const username = usernameOf(session);
  if (!username) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const roles = session.user.roles ?? [];
  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-PS-User", username);
  headers.set("X-PS-Roles", roles.join(","));
  const source = new URL(req.url);
  const target = `${backendUrl()}/api/${path.map(encodeURIComponent).join("/")}${source.search}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  try {
    const answer = await fetch(target, { method: req.method, headers, body, cache: "no-store" });
    return new Response(answer.body, { status: answer.status, headers: { "content-type": answer.headers.get("content-type") ?? "application/json" } });
  } catch {
    return Response.json({ error: "ระบบหลังบ้านยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง" }, { status: 503 });
  }
}

type Context = { params: Promise<{ path: string[] }> };

function handler(req: Request, context: Context) {
  return withAuth(authConfig, async (inner, { session }) => forward(inner, session, (await context.params).path ?? []))(req);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
