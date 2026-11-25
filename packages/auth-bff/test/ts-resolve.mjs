/**
 * Lets node run this package's TypeScript sources directly in tests.
 *
 * The sources use extensionless relative imports (the Next bundler adds the
 * extension); node's ESM resolver does not, so this hook tries .ts first.
 *
 *   node --experimental-strip-types --import ./test/ts-resolve.mjs --test test/*.test.ts
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import { register } from "node:module";

if (!process.env.__TS_RESOLVE_REGISTERED) {
  process.env.__TS_RESOLVE_REGISTERED = "1";
  register(import.meta.url, import.meta.url);
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".")) {
    const base = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const bare = specifier.replace(/\.js$/, "");
    if (!/\.[cm]?[jt]sx?$/.test(bare)) {
      for (const ext of [".ts", "/index.ts"]) {
        const candidate = resolvePath(base, bare + ext);
        if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
      }
    }
  }
  return next(specifier, context);
}
