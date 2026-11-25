"use client";

import {
  useAuth,
  type User,
  type AuthStatus,
  type ForbiddenReason,
} from "@repo/auth-core";

export interface SessionValue {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  /** Why the BFF refused authorization; set only when status is "forbidden" */
  forbiddenReason: ForbiddenReason | null;
  login: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

/**
 * Hook returning the current PromptServ session.
 *
 * - `status`: "loading" | "authenticated" | "unauthenticated"
 * - `user`: decoded user info (id, name, email, roles) or null
 * - `accessToken`: current JWT for API calls (null when unauthenticated)
 * - `login()`: redirects to `/api/auth/login`
 * - `logout()`: redirects to `/api/auth/logout`
 * - `refresh()`: force re-checks session via `/api/config`
 */
export function useSession(): SessionValue {
  const auth = useAuth();
  return {
    status: auth.status,
    user: auth.user,
    accessToken: auth.accessToken,
    forbiddenReason: auth.forbiddenReason,
    login: auth.login,
    logout: auth.logout,
    refresh: auth.refresh,
  };
}
