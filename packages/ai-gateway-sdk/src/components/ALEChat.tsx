"use client";

import React, { useState } from "react";

import { useAdvancedPromptChat } from "../hooks";
import type { PromptServClient } from "../client";
import { MemoryDrawer } from "./MemoryDrawer";

export interface ALEChatProps {
  /**
   * BFF route path for chat completions. Default: "/api/chat".
   * Apps that mount the chat proxy under a different path can override.
   */
  api?: string;
  /**
   * Optional client passed to ``MemoryDrawer``. When provided, the chat
   * panel renders a "Memory" toggle in the header. Apps that don't want
   * the drawer can omit this prop entirely.
   */
  client?: PromptServClient;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Tailwind classes appended to the root container. */
  className?: string;
  /** Container height. Default "h-[600px]". */
  height?: string;
}

/**
 * Drop-in chat panel that wires ``useAdvancedPromptChat`` (existing SDK
 * v0.1 hook — handles SSE deltas, steps, thinking) to a minimal Tailwind
 * UI. Augments with two ALE-specific UX bits when ``client`` is set:
 *
 *   1. **Memory pill** in the header: opens ``MemoryDrawer`` so the user
 *      can audit/delete what the LLM has saved about them.
 *   2. **Step badges** that highlight ``ale_recall_memory`` and
 *      ``ale_search_skills`` invocations — visible feedback that the
 *      assistant is consulting ALE (not generating from scratch).
 *
 * For richer UX, copy this file into your app and customise — the hook
 * (``useAdvancedPromptChat``) is the stable surface, this component is
 * just one rendering of it.
 */
export function ALEChat({
  api = "/api/chat",
  client,
  placeholder = "Ask anything...",
  className = "",
  height = "h-[600px]",
}: ALEChatProps) {
  const {
    messages,
    isStreaming,
    streamingText,
    activeSteps,
    sendMessage,
    stop,
  } = useAdvancedPromptChat({ api });

  const [draft, setDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isStreaming) return;
    setDraft("");
    await sendMessage(text);
  };

  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-200 bg-white ${height} ${className}`}
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h3 className="text-sm font-medium text-gray-700">ALE Chat</h3>
        {client && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            title="View what ALE remembers about you"
          >
            🧠 Memory
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !isStreaming && (
          <p className="text-center text-sm text-gray-400">
            Start a conversation. ALE recalls user-scoped memory + skills.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.messageId}
            className={`flex ${m.isCreatedByUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.isCreatedByUser
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isStreaming && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900">
              {streamingText}
            </div>
          </div>
        )}
        {activeSteps.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeSteps.map((s) => {
              const isALE =
                s.toolName?.startsWith("ale_") ||
                s.title?.toLowerCase().includes("ale");
              return (
                <span
                  key={s.id}
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    isALE
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                  title={s.detail || s.toolName || ""}
                >
                  {isALE ? "🧠 " : ""}
                  {s.title || s.toolName || "step"}
                  {s.status === "running" ? "..." : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          disabled={isStreaming}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            Send
          </button>
        )}
      </form>

      {client && (
        <MemoryDrawer
          client={client}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
