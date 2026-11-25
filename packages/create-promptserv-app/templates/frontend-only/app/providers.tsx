"use client";

import { PromptServAuthProvider } from "@repo/ai-gateway-sdk/auth/keycloak/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return <PromptServAuthProvider>{children}</PromptServAuthProvider>;
}
