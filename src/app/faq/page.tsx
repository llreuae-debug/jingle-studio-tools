"use client";

import React from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { getFaqEntries } from "@/content/site-content";

export default function FaqPage() {
  const { locale } = useLanguage();
  const entries = getFaqEntries();

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--plum)]">
          {locale === "id" ? "Pertanyaan yang Sering Diajukan" : "Frequently Asked Questions"}
        </h1>
        <p className="text-sm text-[var(--plum-muted)]">
          {locale === "id"
            ? "Jawaban jelas tentang Kredensial Konten C2PA, SynthID, privasi, dan label platform."
            : "Plain answers about C2PA Content Credentials, SynthID, privacy, and platform labels."}
        </p>
      </div>

      <div className="space-y-3">
        {entries.map((item, idx) => (
          <details key={idx} open={idx < 3} className="glass-surface p-5">
            <summary className="cursor-pointer font-semibold text-sm text-[var(--plum)]">
              {item.q[locale]}
            </summary>
            <p className="mt-2 text-xs text-[var(--plum-muted)] leading-relaxed">
              {item.a[locale]}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
