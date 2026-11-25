"use client";

/**
 * AuthProvider - fetches auth state from BFF `/api/config` endpoint.
 *
 * Why fetch-based (not localStorage): tokens are stored in HttpOnly cookies
 * managed by Next.js API Routes (BFF pattern from promptserv-chat).
 * The client never touches tokens directly - it only knows if it's
 * authenticated and who the user is.
 *
 * Backwards compatibility: both `isAuthenticated` (boolean) and `status`
 * (string literal) are exposed so existing consumers continue working.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "forbidden";

/** Why the BFF refused authorization, surfaced so the UI can explain it. */
export interface ForbiddenReason {
  /** Machine-readable code from the BFF, e.g. "insufficient_role", "channel_access_denied" */
  code: string;
  /** Human-readable message from the BFF, when it provided one */
  message: string | null;
}

export interface AuthContextType {
  /** Auth status as a 3-state enum - preferred over isAuthenticated */
  status: AuthStatus;
  /** @deprecated Use `status` instead. Kept for backwards compatibility. */
  isAuthenticated: boolean;
  /** Current user info from JWT claims, null if not authenticated */
  user: User | null;
  /** Access token for API calls (e.g. AI Gateway). null if not authenticated. */
  token: string | null;
  /** Alias for token - same value */
  accessToken: string | null;
  /** Set when `status === "forbidden"`, null otherwise */
  forbiddenReason: ForbiddenReason | null;
  /** Redirect to BFF login endpoint → Keycloak */
  login: () => void;
  /** Redirect to BFF logout endpoint → clear session */
  logout: () => void;
  /** Force re-check auth status from BFF */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [forbiddenReason, setForbiddenReason] =
    useState<ForbiddenReason | null>(null);

  /**
   * Fetch user info from BFF.
   *
   * Why credentials: 'include': the session cookie (ps-token) is HttpOnly,
   * so fetch needs to explicitly include cookies in the request.
   */
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/config", { credentials: "include" });

      // ANY 403 means the BFF accepted the JWT but refused authorization -
      // the user IS authenticated, just not allowed in. Never map this to
      // "unauthenticated": ProtectedRoute would bounce to Keycloak, which
      // still holds a valid SSO session and hands back a fresh token, which
      // lands on the same 403. That is an infinite login loop (observed on
      // TCC: ~2 full code exchanges/second until the tab was closed).
      //
      // Matching on the error code specifically was the original bug - only
      // `insufficient_role` was handled, so `channel_access_denied` from the
      // auth-bff channel gate fell through to the !res.ok branch below. Treat
      // the STATUS as authoritative and keep the code purely informational so
      // future BFF gates are loop-safe by default.
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        setForbiddenReason({
          code: typeof body?.error === "string" ? body.error : "forbidden",
          message: typeof body?.message === "string" ? body.message : null,
        });
        setStatus("forbidden");
        setUser(null);
        setToken(null);
        return;
      }
      if (!res.ok) {
        setForbiddenReason(null);
        setStatus("unauthenticated");
        setUser(null);
        setToken(null);
        return;
      }
      const data = await res.json();
      setForbiddenReason(null);
      setUser(data.user ?? null);
      setToken(data.access_token ?? null);
      setStatus("authenticated");
    } catch {
      setForbiddenReason(null);
      setStatus("unauthenticated");
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/api/auth/logout";
  }, []);

  const value: AuthContextType = {
    status,
    isAuthenticated: status === "authenticated",
    user,
    token,
    accessToken: token,
    forbiddenReason,
    login,
    logout,
    refresh: checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
