"use client";

import { useChat, UseChatOptions } from "@ai-sdk/react";
import { useAuth } from "@repo/auth-core";

export function usePromptServChat(options?: UseChatOptions) {
  const { token } = useAuth();

  return useChat({
    // Default to the standard backend route we'll provide
    api: "/api/chat",
    ...options,
    headers: {
      ...(options?.headers || {}),
      // Pass the JWT token explicitly to the backend route so it can exchange it for a virtualKey
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
}
