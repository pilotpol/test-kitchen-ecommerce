"use client";

import { ALEChat } from "@repo/ai-gateway-sdk/components";

export default function ChatExamplePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Chat</h1>
      <p className="mt-1 text-sm text-gray-600">
        Streamed via <code>/api/chat</code> — channel key stays server-side.
      </p>
      <div className="mt-4 h-[70vh] rounded-lg border bg-white">
        <ALEChat apiPath="/api/chat" placeholder="Ask me anything..." />
      </div>
    </main>
  );
}
