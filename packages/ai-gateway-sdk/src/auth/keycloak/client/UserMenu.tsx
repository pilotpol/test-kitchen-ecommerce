"use client";

import React, { useState } from "react";

import { useSession } from "./useSession";

export interface UserMenuProps {
  className?: string;
  /** Optional custom render for the avatar/trigger. */
  renderTrigger?: (user: {
    name: string;
    email: string;
    initials: string;
  }) => React.ReactNode;
}

/**
 * Dropdown menu showing current user info + a Sign out action.
 * Returns null when the session is not authenticated.
 */
export const UserMenu: React.FC<UserMenuProps> = ({
  className = "",
  renderTrigger,
}) => {
  const { user, status, logout } = useSession();
  const [open, setOpen] = useState(false);

  if (status !== "authenticated" || !user) return null;

  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const triggerInfo = { name: user.name, email: user.email, initials };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-gray-100 hover:bg-gray-200 px-2 py-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {renderTrigger ? (
          renderTrigger(triggerInfo)
        ) : (
          <>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-medium">
              {initials}
            </span>
            <span className="hidden sm:block text-sm text-gray-800">
              {user.name}
            </span>
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg p-2 z-10"
        >
          <div className="px-2 py-1 text-xs text-gray-500">{user.email}</div>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-2 py-1 text-sm text-gray-800 hover:bg-gray-50 rounded"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
