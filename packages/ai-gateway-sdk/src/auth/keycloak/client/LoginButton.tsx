"use client";

import React from "react";

import { useSession } from "./useSession";

export interface LoginButtonProps {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const LoginButton: React.FC<LoginButtonProps> = ({
  children = "Sign in",
  className = "px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50",
  disabled,
}) => {
  const { login, status } = useSession();
  const isLoading = status === "loading";
  return (
    <button
      type="button"
      className={className}
      onClick={login}
      disabled={disabled || isLoading}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
};
