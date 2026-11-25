"use client";

import React from "react";

import { useChannel } from "../reactExt/useChannel";

export interface ChannelStatusProps {
  channelId: string;
  className?: string;
}

export const ChannelStatus: React.FC<ChannelStatusProps> = ({
  channelId,
  className = "",
}) => {
  const { channel, loading, error } = useChannel(channelId);

  if (loading) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-xs text-gray-500 ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
        Loading channel...
      </span>
    );
  }

  if (error || !channel) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-xs text-red-700 ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Channel unavailable
      </span>
    );
  }

  const active = channel.status === "active";
  const color = active ? "bg-green-500" : "bg-amber-500";
  const label = active ? "Active" : "Disabled";

  return (
    <span
      className={`inline-flex items-center gap-2 text-xs text-gray-700 ${className}`}
      title={`Type: ${channel.type}`}
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="font-medium">{channel.name}</span>
      <span className="text-gray-500">· {label}</span>
    </span>
  );
};
