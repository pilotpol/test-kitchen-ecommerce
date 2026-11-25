export const DEFAULT_PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/logout",
  "/api/config",
  "/favicon.ico",
  "/_next",
] as const;

export const DEFAULT_WEBHOOK_PATHS = ["/api/webhooks"] as const;

/**
 * Returns true when `pathname` starts with any entry in `paths`.
 */
export function isPathMatch(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}
