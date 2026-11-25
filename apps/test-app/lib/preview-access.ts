/**
 * Who may open a private test deployment (Playground) of this app.
 *
 * The platform sets these at deploy time; a published app has neither, so
 * nothing here changes how a published app behaves.
 *
 *   PS_APP_PREVIEW=1           this container is a Playground: never indexed
 *   PS_APP_ALLOWED_USERS=a,b   only these usernames (the owner and the people
 *                              they invited) may use it after signing in,
 *                              and anybody holding the SuperAdmin role
 *
 * Do not edit or remove this file: the Playground's privacy depends on it.
 */

export function isPreview(): boolean {
  return process.env.PS_APP_PREVIEW === "1";
}

export function allowedUsers(): string[] {
  return (process.env.PS_APP_ALLOWED_USERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Roles that open every Playground without an invitation. A SuperAdmin runs
 * the platform and must be able to look at any app on it (owner's decision,
 * 2026-10-14); PS_APP_ALLOWED_ROLES can name more, it never removes this one.
 */
export function allowedRoles(): string[] {
  const extra = (process.env.PS_APP_ALLOWED_ROLES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ["SuperAdmin", ...extra];
}

/**
 * True when the list is empty (a published app), the username is on it, or
 * the person holds a role that opens every Playground.
 */
export function mayUse(username: string | undefined | null, roles: readonly string[] = []): boolean {
  const list = allowedUsers();
  if (list.length === 0) return true;
  if (roles.some((role) => allowedRoles().includes(role))) return true;
  return !!username && list.includes(username.trim().toLowerCase());
}
