"use client";

import React, { useState } from "react";

import type { PromptServClient } from "../client";
import { useALEMemory } from "../reactExt/useALEMemory";

export interface MemoryDrawerProps {
  client: PromptServClient;
  /** Controlled open state. */
  open: boolean;
  onClose: () => void;
  /** Optional title — default "Your memories". */
  title?: string;
  /** Tailwind classes appended to the root element. */
  className?: string;
}

/**
 * Drop-in side panel that lists the authenticated user's ALE memories
 * and lets them delete entries.
 *
 * Style: minimal Tailwind-only, no dependency on Radix/Headless UI so it
 * works in any tenant app regardless of their UI kit. Apps that want
 * fancier transitions can wrap their own ``Dialog`` and pass it the same
 * data via ``useALEMemory`` directly.
 */
export function MemoryDrawer({
  client,
  open,
  onClose,
  title = "Your memories",
  className = "",
}: MemoryDrawerProps) {
  const { memories, total, isLoading, error, refresh, remove } = useALEMemory({
    client,
    enabled: open,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close memory drawer"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />

      {/* Panel */}
      <aside
        className={`flex w-full max-w-md flex-col bg-white shadow-xl ${className}`}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">
              {total} {total === 1 ? "entry" : "entries"} stored
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load memories: {error.message}
            </div>
          )}
          {isLoading && memories.length === 0 && (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          )}
          {!isLoading && !error && memories.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              No memories yet. ALE will save things you tell her in chat.
            </div>
          )}
          <ul className="divide-y divide-gray-100">
            {memories.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap text-sm text-gray-900">
                      {m.content}
                    </p>
                    {m.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(m.created_at * 1000).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setDeletingId(m.id);
                      try {
                        await remove(m.id);
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                    disabled={deletingId === m.id}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === m.id ? "..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
