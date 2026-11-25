"use client";

import { PromptServAuthProvider } from "@repo/ai-gateway-sdk/auth/keycloak/client";
import { PromptServClientProvider } from "@repo/ai-gateway-sdk/react-ext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PromptServAuthProvider>
      <PromptServClientProvider
        options={{
          aiGatewayUrl: "/api",
          auth: { kind: "channel", channelApiKey: "proxied-server-side" },
        }}
      >
        {children}
      </PromptServClientProvider>
    </PromptServAuthProvider>
  );
}
