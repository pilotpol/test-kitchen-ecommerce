import { DEFAULT_PUBLIC_PATHS, DEFAULT_WEBHOOK_PATHS, isPathMatch } from "./matchers";

export interface WithPromptServAuthOptions {
  /** Cookie name carrying the encrypted session. Default: `ps-token`. */
  cookieName?: string;
  /** Paths that should skip auth — auth endpoints, webhooks, public pages. */
  publicPaths?: readonly string[];
  /** Paths that should always bypass auth (webhooks must). */
  webhookPaths?: readonly string[];
  /** Where to redirect unauthenticated browser requests. Default: `/login`. */
  redirectTo?: string;
  /**
   * When true, API requests without a session get 401 instead of redirect.
   * Default: true (saner for fetch-from-browser and programmatic clients).
   */
  jsonForApi?: boolean;
}

interface MiddlewareRequestLike {
  nextUrl: { pathname: string; search?: string; origin?: string };
  cookies: { get: (name: string) => { value: string } | undefined };
  url: string;
}

/**
 * Next.js middleware factory — call from `middleware.ts`:
 *
 * ```ts
 * // middleware.ts
 * import { NextResponse } from "next/server";
 * import { withPromptServAuth } from "@repo/ai-gateway-sdk/next/middleware";
 *
 * export default withPromptServAuth({ NextResponse });
 * export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.).*)"] };
 * ```
 *
 * The wrapper injects `NextResponse` instead of importing it directly so the
 * SDK stays decoupled from the Next.js runtime version the consumer ships.
 */
export function withPromptServAuth(
  opts: WithPromptServAuthOptions & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NextResponse: any;
  },
) {
  const cookieName = opts.cookieName ?? "ps-token";
  const publicPaths = opts.publicPaths ?? DEFAULT_PUBLIC_PATHS;
  const webhookPaths = opts.webhookPaths ?? DEFAULT_WEBHOOK_PATHS;
  const redirectTo = opts.redirectTo ?? "/login";
  const jsonForApi = opts.jsonForApi ?? true;
  const { NextResponse } = opts;

  return function middleware(req: MiddlewareRequestLike) {
    const pathname = req.nextUrl.pathname;

    if (isPathMatch(pathname, publicPaths) || isPathMatch(pathname, webhookPaths)) {
      return NextResponse.next();
    }

    const hasSession = Boolean(req.cookies.get(cookieName)?.value);
    if (hasSession) return NextResponse.next();

    const isApi = pathname.startsWith("/api/");
    if (isApi && jsonForApi) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      );
    }

    const loginUrl = new URL(redirectTo, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  };
}
