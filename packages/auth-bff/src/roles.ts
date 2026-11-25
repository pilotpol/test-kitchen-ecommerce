/**
 * Role gate and mock user, shared by /api/config (handlers.ts) and the
 * server-side session check (session.ts) so both enforce exactly the same
 * rule.
 */

import type { AuthConfig, AuthUser } from "./types";

/**
 * ผู้ใช้จำลองของโหมด AUTH_MOCK=true: บทบาทกลาง + บทบาทที่แอปนั้นกำหนดให้เข้าได้ (requiredRoles)
 * + บทบาทเพิ่มของแอป (mockRoles) เดิมรายการนี้ตรึงบทบาทของทุกแอปไว้ในไลบรารีกลาง
 * ชื่อโครงการของลูกค้ารายอื่นจึงติดไปใน image ของทุกแอปที่ส่งมอบ
 */
const MOCK_BASE_ROLES = ["AI_USER", "PORTAL_ADMIN", "Admin", "User"];

export function mockUser(config: AuthConfig): AuthUser {
  const roles = [...new Set([...MOCK_BASE_ROLES, ...(config.requiredRoles ?? []), ...(config.mockRoles ?? [])])];
  return { id: "mock-user-1", name: "Mock User", email: "mock@promptserv.local", roles };
}

/**
 * Verify the user's realm roles against config.requiredRoles (OR semantics).
 * Returns 403 Response on denial; null when allowed or gating disabled.
 *
 * Why no cookie clear on denial: the JWT itself is valid - the user is
 * authenticated, just not authorized. They choose to logout via the
 * forbidden panel; we don't kill the session for them.
 */
export function checkRequiredRolesAgainstUser(
  config: AuthConfig,
  userRoles: string[],
  userId?: string,
): Response | null {
  // SuperAdmin is the platform operator and opens every app, regardless of the
  // per-app gate. Keeping the bypass here - not in each app's
  // AUTH_REQUIRED_ROLES - means a newly deployed app is reachable by SuperAdmin
  // the moment it is up, with no per-app role list to maintain.
  if (userRoles.includes("SuperAdmin")) return null;
  if (!config.requiredRoles || config.requiredRoles.length === 0) return null;
  const ok = config.requiredRoles.some((r) => userRoles.includes(r));
  if (ok) return null;
  console.info(
    `[auth-bff] insufficient_role - user=${userId ?? "mock"} has=${userRoles.join(",")} required=${config.requiredRoles.join(",")}`,
  );
  return Response.json(
    { error: "insufficient_role", message: "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ" },
    { status: 403 },
  );
}
