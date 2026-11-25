import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
    server: "src/server.ts",
    client: "src/client.ts",
    errors: "src/errors.ts",
    auth: "src/auth.ts",
    transport: "src/transport.ts",
    "typesExt/index": "src/typesExt/index.ts",
    "reactExt/index": "src/reactExt/index.ts",
    "components/index": "src/components/index.ts",
    "nextExt/index": "src/nextExt/index.ts",
    "auth/keycloak/index": "src/auth/keycloak/index.ts",
    "auth/keycloak/client/index": "src/auth/keycloak/client/index.ts",
    "auth/keycloak/server/index": "src/auth/keycloak/server/index.ts",
    "webhooks/index": "src/webhooks/index.ts",
    "config/index": "src/config/index.ts",
    "next/index": "src/next/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  external: ["react", "react-dom", "next"],
});
