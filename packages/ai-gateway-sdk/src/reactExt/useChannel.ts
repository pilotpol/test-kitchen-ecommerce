"use client";

import { useCallback, useEffect, useState } from "react";

import type { Channel } from "../typesExt/channel";

import { usePromptServClient } from "./PromptServClientProvider";

export interface UseChannelResult {
  channel: Channel | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the current channel's metadata. Returns `null` until loaded.
 *
 * Requires the surrounding `<PromptServClientProvider>` auth to be
 * `master` (admin read) or a future channel-key read endpoint.
 */
export function useChannel(channelId: string): UseChannelResult {
  const client = usePromptServClient();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await client.channels.get(channelId);
      setChannel(c);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [client, channelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { channel, loading, error, refresh };
}
