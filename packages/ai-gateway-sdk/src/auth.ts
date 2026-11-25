/**
 * Auth strategies for PromptServ AI Gateway.
 *
 * Gateway accepts three distinct auth modes:
 *   1. "channel"      — single Bearer channel API key (system-to-system)
 *   2. "channel-user" — X-Channel-Key + Authorization Bearer JWT (user identity
 *                        preserved through channel for budgeting / logging)
 *   3. "master"       — master key for /admin/* endpoints
 */

export type AuthStrategy =
  | { kind: "channel"; channelApiKey: string }
  | { kind: "channel-user"; channelApiKey: string; userJwt: string }
  | { kind: "master"; masterKey: string };

export function headersForAuth(auth: AuthStrategy): Record<string, string> {
  switch (auth.kind) {
    case "channel":
      return { Authorization: `Bearer ${auth.channelApiKey}` };
    case "channel-user":
      return {
        "X-Channel-Key": auth.channelApiKey,
        Authorization: `Bearer ${auth.userJwt}`,
      };
    case "master":
      return { Authorization: `Bearer ${auth.masterKey}` };
  }
}

/** True if this auth strategy can call /admin/* endpoints. */
export function canCallAdmin(auth: AuthStrategy): boolean {
  return auth.kind === "master";
}
