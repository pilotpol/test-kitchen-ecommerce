"use client";

import type { ForbiddenReason } from "@repo/auth-core";
import React, { useEffect, useState, type ReactNode } from "react";

import { useSession } from "./useSession";

// ---------------------------------------------------------------------------
// Redirect loop guard
// ---------------------------------------------------------------------------
//
// Bouncing an unauthenticated user to Keycloak is only safe if the round trip
// can actually change the outcome. When it cannot - the BFF rejects the
// session for a reason a fresh token does not fix - Keycloak's still-valid SSO
// session hands back a new code instantly and we land right back here. That is
// an unthrottled infinite loop: full authorization-code exchanges at browser
// redirect speed, hammering Keycloak and the BFF until the tab is closed.
//
// We record one redirect attempt in sessionStorage (per-tab, so parallel tabs
// don't interfere). Coming back still unauthenticated inside the window means
// the redirect did not help, so we stop and show the user an exit instead of
// looping. A successful auth clears the marker, keeping the normal
// login → app → logout → login cycle unaffected.

const REDIRECT_GUARD_KEY = "ps-auth-login-redirect";
/** How long after a redirect a still-unauthenticated return counts as a loop. */
const REDIRECT_GUARD_WINDOW_MS = 15_000;

/**
 * Module-level latch, reset naturally by every full page load.
 *
 * React StrictMode (Next.js default in dev) mounts → unmounts → remounts, so
 * the effect below fires twice. Without this latch the second run would read
 * the marker the first run just wrote and misreport a loop on a perfectly
 * normal first login. A ref won't do - StrictMode remounts discard refs.
 */
let redirectDecidedThisPageLoad = false;

/** sessionStorage throws in Safari private mode - never let that break auth. */
function readGuard(): number | null {
  try {
    const raw = window.sessionStorage.getItem(REDIRECT_GUARD_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function markGuard(): void {
  try {
    window.sessionStorage.setItem(REDIRECT_GUARD_KEY, String(Date.now()));
  } catch {
    /* best-effort - a missing marker only costs us the loop protection */
  }
}

function clearGuard(): void {
  try {
    window.sessionStorage.removeItem(REDIRECT_GUARD_KEY);
  } catch {
    /* best-effort */
  }
}

export interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional fallback while status is "loading". */
  fallback?: ReactNode;
  /** Where to send unauthenticated users. Default: triggers `login()`. */
  redirectTo?: string;
  /**
   * Additional client-side role check. The BFF `/api/config` already
   * enforces server-side gating via auth-bff `requiredRoles`, so the
   * `forbidden` status arrives without this prop being set. Use this
   * only when you need to gate a sub-tree of an already-authenticated
   * app (e.g. an admin panel inside FDA).
   */
  requiredRoles?: string[];
  /** Custom UI when the user lacks a required role. */
  forbiddenFallback?: ReactNode;
}

/**
 * Client-side gate. Renders `children` only when the session is
 * authenticated AND any role check passes.
 *
 * Auth states handled:
 *   loading        → `fallback` (default: full-screen spinner)
 *   unauthenticated → triggers login() or navigates to `redirectTo`,
 *                     at most once per tab (see redirect loop guard above)
 *   forbidden       → `forbiddenFallback` (default panel with logout button)
 *   authenticated   → render children
 *
 * The `forbidden` status is set by the AuthProvider on ANY 403 from
 * `/api/config`, so every BFF gate - realm roles (User_<แอป>)
 * and the channel permission check alike - lands on the forbidden panel
 * rather than the login redirect. This component never needs to know the
 * role or channel names; they live in env config.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback,
  redirectTo,
  requiredRoles,
  forbiddenFallback,
}) => {
  const { status, user, login, logout, forbiddenReason } = useSession();
  const [loopBlocked, setLoopBlocked] = useState(false);

  useEffect(() => {
    // Any resolved session (allowed or refused) proves the redirect path is
    // healthy, so retire the guard for the next genuine login.
    if (status === "authenticated" || status === "forbidden") {
      clearGuard();
      return;
    }
    if (status !== "unauthenticated") return;

    if (typeof window === "undefined") {
      login();
      return;
    }

    // Already navigating (or already ruled a loop) for this page load.
    if (redirectDecidedThisPageLoad) return;

    const lastAttempt = readGuard();
    if (lastAttempt !== null && Date.now() - lastAttempt < REDIRECT_GUARD_WINDOW_MS) {
      // We already sent this tab through Keycloak and came back no better off.
      // Redirecting again would just spin.
      redirectDecidedThisPageLoad = true;
      clearGuard();
      setLoopBlocked(true);
      return;
    }

    redirectDecidedThisPageLoad = true;
    markGuard();
    if (redirectTo) {
      window.location.href = redirectTo;
    } else {
      const next = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.href = `/api/auth/login?next=${next}`;
    }
  }, [status, login, redirectTo]);

  if (loopBlocked) {
    return <LoginLoopPanel onLogout={logout} />;
  }

  if (status === "loading" || status === "unauthenticated") {
    return <>{fallback ?? <AuthLoading />}</>;
  }

  if (status === "forbidden") {
    return (
      <>
        {forbiddenFallback ?? (
          <ForbiddenPanel onLogout={logout} reason={forbiddenReason} />
        )}
      </>
    );
  }

  // Optional client-side role check on top of server-side gating.
  if (requiredRoles && requiredRoles.length > 0) {
    const userRoles = user?.roles ?? [];
    const ok = requiredRoles.some((r) => userRoles.includes(r));
    if (!ok) {
      return (
        <>
          {forbiddenFallback ?? (
            <ForbiddenPanel onLogout={logout} reason={null} />
          )}
        </>
      );
    }
  }

  return <>{children}</>;
};

const AuthLoading: React.FC = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8fafc",
    }}
  >
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: "4px solid #cbd5e1",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "ps-auth-spin 0.8s linear infinite",
        }}
      />
      <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>กำลังตรวจสอบสิทธิ์...</p>
      <style>{`@keyframes ps-auth-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

const PANEL_WRAP: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
  padding: 16,
};

const PANEL_CARD: React.CSSProperties = {
  maxWidth: 420,
  width: "100%",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "white",
  padding: 32,
  textAlign: "center",
  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
};

const PANEL_BUTTON: React.CSSProperties = {
  background: "#0f172a",
  color: "white",
  padding: "8px 20px",
  borderRadius: 8,
  fontSize: 14,
  border: "none",
  cursor: "pointer",
};

const PANEL_BUTTON_SECONDARY: React.CSSProperties = {
  ...PANEL_BUTTON,
  background: "white",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
};

/** Per-gate copy. Falls back to the BFF's own message, then a generic line. */
const FORBIDDEN_COPY: Record<string, string> = {
  insufficient_role:
    "บัญชีของท่านยังไม่มีสิทธิ์เข้าใช้งานระบบนี้ กรุณาติดต่อผู้ดูแลระบบ",
  channel_access_denied:
    "บัญชีของท่านยังไม่ได้รับสิทธิ์เข้าถึงช่องทางการใช้งานนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอเปิดสิทธิ์",
};

const ForbiddenPanel: React.FC<{
  onLogout: () => void;
  reason: ForbiddenReason | null;
}> = ({ onLogout, reason }) => (
  <div style={PANEL_WRAP}>
    <div style={PANEL_CARD}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
        ไม่มีสิทธิ์เข้าใช้งาน
      </h1>
      <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
        {(reason && FORBIDDEN_COPY[reason.code]) ??
          reason?.message ??
          "บัญชีของท่านยังไม่มีสิทธิ์เข้าใช้งานระบบนี้ กรุณาติดต่อผู้ดูแลระบบ"}
      </p>
      <button onClick={onLogout} style={PANEL_BUTTON}>
        ออกจากระบบ
      </button>
    </div>
  </div>
);

/**
 * Shown when a Keycloak round trip returned us here still unauthenticated.
 * Retrying in place is the cheap fix for a one-off (a transient /api/config
 * failure, a dropped cookie); logging out clears a genuinely broken session.
 */
const LoginLoopPanel: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div style={PANEL_WRAP}>
    <div style={PANEL_CARD}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
        เข้าสู่ระบบไม่สำเร็จ
      </h1>
      <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
        ระบบไม่สามารถยืนยันตัวตนของท่านได้หลังจากเข้าสู่ระบบ
        กรุณาลองใหม่อีกครั้ง หากยังพบปัญหา กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่
        หรือติดต่อผู้ดูแลระบบ
      </p>
      <div
        style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
      >
        <button
          onClick={() => {
            clearGuard();
            window.location.reload();
          }}
          style={PANEL_BUTTON}
        >
          ลองใหม่อีกครั้ง
        </button>
        <button onClick={onLogout} style={PANEL_BUTTON_SECONDARY}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  </div>
);
