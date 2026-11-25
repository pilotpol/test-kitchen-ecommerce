"use client";

import {
  LoginButton,
  UserMenu,
  useSession,
} from "@repo/ai-gateway-sdk/auth/keycloak/client";
import { ErrorBoundary } from "@repo/ai-gateway-sdk/components";

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
          <p className="mt-1 text-sm text-gray-600">Sign in to continue.</p>
          <div className="mt-4">
            <LoginButton className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <main className="mx-auto max-w-5xl p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">test-app-</h1>
          <UserMenu />
        </header>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              Chat
            </h2>
            <p className="text-xs text-gray-500">
              Hello, {user?.name}. Use the examples below to exercise the SDK.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-blue-700">
              <li>
                <a className="hover:underline" href="/examples/chat">
                  /examples/chat
                </a>
              </li>
              <li>
                <a className="hover:underline" href="/examples/workflow">
                  /examples/workflow
                </a>
              </li>
              <li>
                <a className="hover:underline" href="/examples/upload">
                  /examples/upload
                </a>
              </li>
              <li>
                <a className="hover:underline" href="/examples/approvals">
                  /examples/approvals
                </a>
              </li>
            </ul>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              Session
            </h2>
            <dl className="text-xs text-gray-700">
              <dt className="mt-1 font-medium">Email</dt>
              <dd>{user?.email}</dd>
              <dt className="mt-2 font-medium">Roles</dt>
              <dd>{user?.roles?.join(", ") || "—"}</dd>
            </dl>
          </div>
        </section>
      </main>
    </ErrorBoundary>
  );
}
