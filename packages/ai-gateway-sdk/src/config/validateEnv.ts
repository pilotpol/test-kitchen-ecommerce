import { EnvSchema, type ValidatedEnv } from "./schema";

export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Validates `process.env` against the SDK's expected schema.
 * Throws `EnvValidationError` with a friendly summary when required vars are
 * missing or malformed — point users at docs/env-variables.md.
 */
export function validateEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ValidatedEnv {
  const result = EnvSchema.safeParse(env);
  if (result.success) return result.data;

  const issues = result.error.issues.map((iss) => ({
    path: iss.path.join("."),
    message: iss.message,
  }));
  const summary = issues
    .map((i) => `  • ${i.path}: ${i.message}`)
    .join("\n");
  throw new EnvValidationError(
    `Invalid PromptServ environment variables — see docs/env-variables.md:\n${summary}`,
    issues,
  );
}
