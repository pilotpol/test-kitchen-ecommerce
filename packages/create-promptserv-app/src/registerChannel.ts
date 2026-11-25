import pc from "picocolors";

import type { ScaffoldAnswers } from "./prompts";

/**
 * Optional: pre-register the channel in AI Gateway admin. Requires
 * `PROMPTSERV_MASTER_KEY` + `PROMPTSERV_GATEWAY_URL` env vars.
 * Failures are non-fatal — the dev can register manually later.
 */
export async function maybeRegisterChannel(
  answers: ScaffoldAnswers,
): Promise<void> {
  const masterKey = process.env.PROMPTSERV_MASTER_KEY;
  const gatewayUrl = process.env.PROMPTSERV_GATEWAY_URL;
  if (!masterKey || !gatewayUrl) return;

  try {
    const res = await fetch(
      `${gatewayUrl.replace(/\/+$/, "")}/admin/channels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${masterKey}`,
        },
        body: JSON.stringify({
          id: answers.channelId || undefined,
          name: answers.appName,
          type: answers.channelType,
          entry_point_id: "",
        }),
      },
    );
    if (!res.ok) {
      console.log(
        pc.yellow(`  ! channel registration skipped (${res.status})`),
      );
      return;
    }
    const body = (await res.json()) as { id?: string };
    console.log(pc.dim(`  · channel registered: ${body.id ?? answers.channelId}`));
  } catch (err) {
    console.log(
      pc.yellow(
        `  ! channel registration failed: ${(err as Error).message} (skipping)`,
      ),
    );
  }
}
