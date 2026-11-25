"use client";

import { useAuth } from "@repo/auth-core";

/**
 * The starting page of a new app. Replace it with the app's own first screen.
 * Sign-in is already wired (see lib/auth-config.ts and app/api/auth).
 */
export default function Home() {
  const { user, isAuthenticated, login, logout, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-semibold">แอปใหม่บน Prompt Serve</h1>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">{user?.email}</span>
              <button onClick={logout} className="rounded px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <button onClick={login} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-700">
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-neutral-400">หน้านี้คือจุดเริ่มต้นของแอป เนื้อหาของแอปจะแสดงที่นี่</p>
      </main>
    </div>
  );
}
