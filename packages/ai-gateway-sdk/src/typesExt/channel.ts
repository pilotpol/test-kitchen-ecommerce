/** Channel types supported by PromptServ Gateway (aligned with internal/store/channels.go). */
export type ChannelType =
  | "WEB"
  | "WEB_APP" // new — form / web app channel (BAAC etc.)
  | "LINE"
  | "TELEGRAM"
  | "IOT"
  | "DOCUMENT";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  entry_point_id: string; // workflow or agent id
  webhook_urn: string;
  status: "active" | "disabled";
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateChannelInput {
  id?: string;
  name: string;
  type: ChannelType;
  entry_point_id: string;
  config?: Record<string, unknown>;
}

export interface ChannelKey {
  key: string;
  channel_id: string;
  channel_type: string;
  created_at: string;
}
