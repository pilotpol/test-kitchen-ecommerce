/**
 * PromptServ Gateway error hierarchy.
 *
 * All errors emitted by the SDK subclass PromptServError so callers can
 * do `if (err instanceof AuthError)` instead of string-matching messages.
 *
 * Gateway error shape (from internal/middleware/auth.go):
 *   { "error": { "message": string, "type": string, "code": number } }
 */

export interface GatewayErrorShape {
  error: {
    message: string;
    type?: string;
    code?: number;
  };
}

export class PromptServError extends Error {
  public code: number;
  public type: string;
  public traceId?: string;
  public raw?: unknown;

  constructor(opts: {
    message: string;
    code: number;
    type?: string;
    traceId?: string;
    raw?: unknown;
  }) {
    super(opts.message);
    this.name = "PromptServError";
    this.code = opts.code;
    this.type = opts.type ?? "unknown_error";
    this.traceId = opts.traceId;
    this.raw = opts.raw;
  }
}

export class AuthError extends PromptServError {
  constructor(args: ConstructorParameters<typeof PromptServError>[0]) {
    super({ ...args, type: args.type ?? "authentication_error" });
    this.name = "AuthError";
  }
}

export class BudgetExceededError extends PromptServError {
  constructor(args: ConstructorParameters<typeof PromptServError>[0]) {
    super({ ...args, type: args.type ?? "budget_exceeded" });
    this.name = "BudgetExceededError";
  }
}

export class RateLimitError extends PromptServError {
  public retryAfter?: number;
  constructor(
    args: ConstructorParameters<typeof PromptServError>[0] & {
      retryAfter?: number;
    },
  ) {
    super({ ...args, type: args.type ?? "rate_limit_error" });
    this.name = "RateLimitError";
    this.retryAfter = args.retryAfter;
  }
}

export class ValidationError extends PromptServError {
  public fields?: Record<string, string>;
  constructor(
    args: ConstructorParameters<typeof PromptServError>[0] & {
      fields?: Record<string, string>;
    },
  ) {
    super({ ...args, type: args.type ?? "validation_error" });
    this.name = "ValidationError";
    this.fields = args.fields;
  }
}

export class WorkflowError extends PromptServError {
  public executionId?: string;
  constructor(
    args: ConstructorParameters<typeof PromptServError>[0] & {
      executionId?: string;
    },
  ) {
    super({ ...args, type: args.type ?? "workflow_error" });
    this.name = "WorkflowError";
    this.executionId = args.executionId;
  }
}

export class NetworkError extends PromptServError {
  constructor(args: ConstructorParameters<typeof PromptServError>[0]) {
    super({ ...args, type: args.type ?? "network_error" });
    this.name = "NetworkError";
  }
}

/**
 * Parse a gateway HTTP Response into the right typed error.
 * Response body must already be consumed as text by caller.
 */
export function parseGatewayError(
  status: number,
  bodyText: string,
  traceId?: string,
): PromptServError {
  let parsed: GatewayErrorShape | undefined;
  try {
    parsed = JSON.parse(bodyText) as GatewayErrorShape;
  } catch {
    // not JSON — wrap as generic
  }

  const message = parsed?.error?.message ?? bodyText ?? `HTTP ${status}`;
  const type = parsed?.error?.type;
  const code = parsed?.error?.code ?? status;
  const base = { message, code, type, traceId, raw: parsed };

  if (status === 401 || status === 403 || type === "authentication_error") {
    return new AuthError(base);
  }
  if (status === 402 || type === "budget_exceeded") {
    return new BudgetExceededError(base);
  }
  if (status === 429 || type === "rate_limit_error") {
    return new RateLimitError(base);
  }
  if (status === 400 || type === "validation_error") {
    return new ValidationError(base);
  }
  return new PromptServError(base);
}
