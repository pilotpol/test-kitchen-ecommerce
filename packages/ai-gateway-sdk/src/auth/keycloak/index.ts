export type { SdkAuthConfig, AuthUser, AuthConfig } from "./types";

// Server exports are safe to import from both server and client code
// because they don't use React. Client exports live under `/client`
// and are gated with "use client".
export * from "./server";
