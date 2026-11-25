import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt, decrypt, getCookieFromRequest } from "@repo/auth-bff";

import { authConfig } from "@/lib/auth-config";
import { allowedUsers, isPreview, mayUse } from "@/lib/preview-access";

/*
 * Playground privacy, enforced on every request (see lib/preview-access.ts).
 * Runs on the Node.js runtime so the platform's runtime environment is read
 * at request time: the Playground and the published app run the same image.
 *
 * Do not edit or remove this file.
 */
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const FORBIDDEN_HTML = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>ไม่มีสิทธิ์เข้าถึง</title></head><body style="font-family:sans-serif;padding:3rem;text-align:center"><h1>ไม่มีสิทธิ์เข้าถึง</h1><p>แอปทดลองนี้เปิดให้เฉพาะเจ้าของและผู้ที่ได้รับเชิญเท่านั้น</p><p><a href="/api/auth/logout">ออกจากระบบ</a></p></body></html>`;

type Person = { username: string; roles: string[] };

function personOf(req: NextRequest): Person | null {
  const sealed = getCookieFromRequest(req, "ps-token");
  if (!sealed) return null;
  try {
    const tokens = JSON.parse(decrypt(sealed, authConfig.cookieSecret)) as { access_token?: string };
    if (!tokens.access_token) return null;
    const claims = decodeJwt(tokens.access_token) as unknown as {
      preferred_username?: string;
      realm_access?: { roles?: unknown };
    };
    if (!claims?.preferred_username) return null;
    const roles = Array.isArray(claims.realm_access?.roles)
      ? (claims.realm_access.roles as unknown[]).filter((r): r is string => typeof r === "string")
      : [];
    return { username: claims.preferred_username, roles };
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const preview = isPreview();
  const path = req.nextUrl.pathname;
  const signInRoute = path.startsWith("/api/auth/") || path === "/login";

  if (allowedUsers().length > 0 && !signInRoute) {
    const person = personOf(req);
    // Not signed in yet: the app's own sign-in takes over. Signed in as someone
    // else: refused, unless their role opens every Playground (SuperAdmin).
    if (person && !mayUse(person.username, person.roles)) {
      return new NextResponse(FORBIDDEN_HTML, {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
  }

  const res = NextResponse.next();
  if (preview) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
