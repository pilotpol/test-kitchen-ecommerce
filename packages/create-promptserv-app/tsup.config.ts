import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["cjs"],
  target: "node20",
  dts: false,
  sourcemap: false,
  splitting: false,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
