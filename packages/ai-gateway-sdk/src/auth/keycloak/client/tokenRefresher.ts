"use client";

import { useEffect } from "react";

import { useSession } from "./useSession";

export interface UseTokenRefresherOptions {
  /** Refresh interval in ms. Default 4 minutes — leaves headroom under
   * Keycloak's typical 5-minute access-token lifetime. */
  intervalMs?: number;
  /** When true, also refreshes once immediately on mount. Default false. */
  refreshOnMount?: boolean;
}

/**
 * Hook that silently hits `/api/config` on an interval so the session cookie
 * gets refreshed before the access token expires. Stops when unauthenticated.
 */
export function useTokenRefresher(opts: UseTokenRefresherOptions = {}): void {
  const { status, refresh } = useSession();
  const intervalMs = opts.intervalMs ?? 4 * 60 * 1000;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (opts.refreshOnMount) void refresh();
    const id = setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [status, intervalMs, opts.refreshOnMount, refresh]);
}
