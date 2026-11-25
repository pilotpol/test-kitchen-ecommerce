"use client";

// Re-export from the auth module so apps can do
// `import { useSession } from "@repo/ai-gateway-sdk/react-ext"`.
export { useSession, type SessionValue } from "../auth/keycloak/client/useSession";
