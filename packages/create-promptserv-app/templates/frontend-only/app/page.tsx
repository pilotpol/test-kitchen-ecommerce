"use client";

import {
  LoginButton,
  LogoutButton,
  UserMenu,
  useSession,
} from "@repo/ai-gateway-sdk/auth/keycloak/client";

export default function HomePage() {
  const { user, status } = useSession();

  if (status === "loading") {
    return <main className="p-8 text-sm text-gray-500">Loading...</main>;
  }
  if (status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Welcome to test-app-</h1>
          <p className="mt-1 text-sm text-gray-600">
            Sign in with your organization account to continue.
          </p>
          <div className="mt-4">
            <LoginButton className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">test-app-</h1>
        <UserMenu />
      </header>
      <section className="mt-6 rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-700">
          Signed in as <strong>{user?.name}</strong> ({user?.email})
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Roles: {user?.roles?.join(", ") || "—"}
        </p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
