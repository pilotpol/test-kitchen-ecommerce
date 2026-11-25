import type { AuthConfig, AuthUser } from "@repo/auth-bff";

/**
 * SDK-branded auth config — superset of @repo/auth-bff AuthConfig with
 * PromptServ defaults (post-login path, logout redirect).
 */
export interface SdkAuthConfig extends AuthConfig {
  /** Where to redirect after successful login. Default: "/" */
  postLoginPath?: string;
  /** Where to redirect after logout. Default: "/login" */
  logoutRedirectPath?: string;
  /**
   * Optional channel permission check on /api/config.
   * When set, users without the channel in their `permissions.apps` list get 403.
   */
  channelId?: string;
  /** Portal-service base URL, required when channelId is set. */
  portalApiUrl?: string;
}

/** Re-export for convenience so consumers don't import two packages. */
export type { AuthUser, AuthConfig };
