"use client";

import { AuthProvider as CoreAuthProvider } from "@repo/auth-core";
import React, { type ReactNode } from "react";

export interface PromptServAuthProviderProps {
  children: ReactNode;
}

/**
 * PromptServ-branded auth provider. Wraps `@repo/auth-core` AuthProvider
 * (which fetches `/api/config` via HttpOnly cookie) so apps can stay on
 * SDK-level imports without pulling `auth-core` directly.
 */
export const PromptServAuthProvider: React.FC<PromptServAuthProviderProps> = ({
  children,
}) => {
  return <CoreAuthProvider>{children}</CoreAuthProvider>;
};
