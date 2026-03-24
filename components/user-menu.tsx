"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "@/components/logout-button";

type UserMenuProps = {
  fullName: string;
  organizationName: string;
};

function getInitials(name: string) {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function UserMenu({
  fullName,
  organizationName,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 transition"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {getInitials(fullName)}
        </div>

        <div className="text-left">
          <div className="text-sm font-medium text-slate-900">{fullName}</div>
          <div className="text-xs text-slate-500">{organizationName}</div>
        </div>

        <svg
          className={`h-4 w-4 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{fullName}</div>
            <div className="text-xs text-slate-500">{organizationName}</div>
          </div>

          <div className="py-2">
            <Link
              href="/users/profile"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              My Profile
            </Link>

            <Link
              href="/users/reset-password"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Reset Password
            </Link>

            <LogoutButton className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50" />
          </div>
        </div>
      ) : null}
    </div>
  );
}