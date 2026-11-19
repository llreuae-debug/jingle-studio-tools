"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AccountMenu({
  user,
}: {
  user: { name?: string | null; email: string; image?: string | null };
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initials = getInitials(user.name, user.email);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 pl-1.5 pr-3 py-1 text-xs font-semibold text-[var(--espresso-black)] hover:bg-[var(--warm-peach)] transition-colors duration-150"
      >
        {user.image && !imgFailed ? (
          <img
            src={user.image}
            alt={user.name || user.email}
            width={24}
            height={24}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--espresso-black)] text-[10px] font-bold text-white"
          >
            {initials}
          </span>
        )}
        <span className="hidden sm:inline max-w-[120px] truncate">
          {user.name || user.email}
        </span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-[20px] border border-[var(--card-border-milky)] bg-white/95 backdrop-blur-xl shadow-[var(--shadow-4)] p-2 z-50 space-y-1 text-xs"
        >
          <div className="px-3 py-2 border-b border-[var(--border)]">
            {user.name && (
              <p className="font-semibold text-[var(--espresso-black)] truncate">{user.name}</p>
            )}
            <p className="text-[var(--color-text-muted)] truncate">{user.email}</p>
          </div>
          <Link
            role="menuitem"
            href="/app"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-[12px] px-3 py-2 font-medium text-[var(--espresso-black)] hover:bg-[var(--warm-peach)]"
          >
            <LayoutDashboard aria-hidden="true" className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <Link
            role="menuitem"
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-[12px] px-3 py-2 font-medium text-[var(--espresso-black)] hover:bg-[var(--warm-peach)]"
          >
            <Settings aria-hidden="true" className="h-3.5 w-3.5" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
              window.location.href = "/tools";
            }}
            className="w-full flex items-center gap-2 rounded-full px-3 py-2 font-medium text-[#a32032] hover:bg-rose-100/70"
          >
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
