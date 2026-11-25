"use client";

import React from "react";

import { useSession } from "./useSession";

export interface LogoutButtonProps {
  children?: React.ReactNode;
  className?: string;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({
  children = "Sign out",
  className = "px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50",
}) => {
  const { logout } = useSession();
  return (
    <button type="button" className={className} onClick={logout}>
      {children}
    </button>
  );
};
