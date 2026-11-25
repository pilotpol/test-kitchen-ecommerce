"use client";

import React from "react";

import { LoginButton } from "../auth/keycloak/client/LoginButton";
import { useSession } from "../auth/keycloak/client/useSession";

export interface LoginPageProps {
  title?: string;
  description?: string;
  logo?: React.ReactNode;
  /** Error string usually read from `?error=...` search param. */
  error?: string | null;
  className?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  title = "Sign in to PromptServ",
  description = "Use your organization account to continue.",
  logo,
  error,
  className = "",
}) => {
  const { status } = useSession();

  return (
    <main
      className={`min-h-screen flex items-center justify-center bg-gray-50 px-4 ${className}`}
    >
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {logo && <div className="mb-4 flex justify-center">{logo}</div>}
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{description}</p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6">
          <LoginButton className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {status === "loading" ? "Checking session..." : "Sign in"}
          </LoginButton>
        </div>
      </div>
    </main>
  );
};
