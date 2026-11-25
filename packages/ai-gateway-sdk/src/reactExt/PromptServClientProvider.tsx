"use client";

import React, { createContext, useContext, useMemo } from "react";

import { PromptServClient, PromptServClientOptions } from "../client";

const ClientContext = createContext<PromptServClient | null>(null);

export interface PromptServClientProviderProps {
  options: PromptServClientOptions;
  children: React.ReactNode;
}

export function PromptServClientProvider({
  options,
  children,
}: PromptServClientProviderProps) {
  const client = useMemo(() => new PromptServClient(options), [
    options.aiGatewayUrl,
    // Re-create client if auth identity changes:
    JSON.stringify(options.auth),
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  );
}

export function usePromptServClient(): PromptServClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error(
      "usePromptServClient must be called within <PromptServClientProvider>",
    );
  }
  return client;
}
