import { createConfigHandler } from "@repo/auth-bff";
import { authConfig } from "@/lib/auth-config";

// Channel permission check: when CHANNEL_ID is set, verifies the user
// has access to this channel via portal-service before returning auth config.
export const GET = createConfigHandler(authConfig, {
  channelId: process.env.CHANNEL_ID,
  portalApiUrl: process.env.PORTAL_API_URL,
});
