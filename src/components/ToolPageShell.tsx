import React from "react";
import Link from "next/link";
import { CORE_TOOLS } from "@/config/tools-catalog";

export interface ToolPageShellProps {
  currentHref: string;
  badge: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ToolPageShell({
  currentHref,
  badge,
  title,
  description,
  children,
}: ToolPageShellProps) {
  const related = CORE_TOOLS.filter((t) => t.href !== currentHref).slice(0, 4);

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-text-muted)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/tools" className="font-semibold text-[var(--color-brand)] hover:underline">
              Tools
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-[var(--color-ink)]">
            {title}
          </li>
        </ol>
      </nav>

      <header className="space-y-3">
        <span className="inline-flex items-center rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-0.5 text-[11px] font-semibold text-[var(--color-brand)]">
          {badge}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>
      </header>

      <main>{children}</main>

      <section aria-label="Related Media Tools" className="border-t border-[var(--border)] pt-8 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">More JingleStudio Tools</h2>
          <Link href="/tools#tools-dashboard" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">
            View all 10 tools →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {related.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-[14px] border border-[var(--border)] bg-white p-4 text-xs hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand-soft)]/50"
            >
              <p className="font-bold text-[var(--color-ink)]">{item.title}</p>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)] line-clamp-2">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
