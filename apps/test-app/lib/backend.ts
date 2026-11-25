import "server-only";

/**
 * Where the Go backend answers: inside the same container, on loopback.
 * Server-side code may call it directly (with the X-PS-User header of the
 * person it acts for); the browser goes through /api/backend/*.
 */
export function backendUrl(): string {
  return process.env.BACKEND_URL || `http://127.0.0.1:${process.env.BACKEND_PORT || "8081"}`;
}

/** Call the backend from a route handler or server component on behalf of [username]. */
export async function backendFetch(path: string, username: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-PS-User", username);
  return fetch(`${backendUrl()}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers, cache: "no-store" });
}
