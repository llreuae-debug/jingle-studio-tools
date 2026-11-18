"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FileCheck2,
  FileSignature,
  Instagram,
  ShieldAlert,
  Video,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { CREDIT_PACKS } from "@/config/pricing";

const TOOL_CARDS = [
  {
    href: "/tools/content-credentials-check",
    title: { en: "Content Credentials Check", id: "Pemeriksaan Kredensial Konten" },
    desc: {
      en: "Inspect C2PA manifests, signer trust, ingredient tree, and AI disclosures locally.",
      id: "Periksa manifes C2PA, kepercayaan penanda tangan, pohon bahan, dan pengungkapan AI secara lokal.",
    },
    badge: { en: "Free • On-device", id: "Gratis • Di perangkat" },
    icon: FileCheck2,
  },
  {
    href: "/tools/instagram-post-check",
    title: { en: "Instagram Post Check", id: "Pemeriksaan Postingan Instagram" },
    desc: {
      en: "Check C2PA signals, 4:5–1.91:1 feed fit, and honest AI label steps.",
      id: "Periksa sinyal C2PA, kesesuaian feed 4:5–1.91:1, dan langkah label AI.",
    },
    badge: { en: "Free • On-device", id: "Gratis • Di perangkat" },
    icon: Instagram,
  },
  {
    href: "/tools/instagram-story-check",
    title: { en: "Instagram Story Check", id: "Pemeriksaan Story Instagram" },
    desc: {
      en: "Verify 9:16 Story fit, provenance signals, and disclosure caption.",
      id: "Verifikasi format Story 9:16, sinyal asal, dan takarir pengungkapan.",
    },
    badge: { en: "Free • On-device", id: "Gratis • Di perangkat" },
    icon: Instagram,
  },
  {
    href: "/tools/instagram-reels-check",
    title: { en: "Instagram Reels Check", id: "Pemeriksaan Reels Instagram" },
    desc: {
      en: "Inspect video Content Credentials, duration fit, and Reels AI label guidance.",
      id: "Periksa Kredensial Konten video, durasi, dan panduan label AI Reels.",
    },
    badge: { en: "Free • On-device", id: "Gratis • Di perangkat" },
    icon: Video,
  },
  {
    href: "/tools/tiktok-ai-label-check",
    title: { en: "TikTok AI Label Check", id: "Pemeriksaan Label AI TikTok" },
    desc: {
      en: "Check declared AI signals and get TikTok's official AI-generated label steps.",
      id: "Periksa sinyal AI yang dideklarasikan dan langkah label AI resmi TikTok.",
    },
    badge: { en: "Free • On-device", id: "Gratis • Di perangkat" },
    icon: Video,
  },
  {
    href: "/tools/ai-disclosure-signer",
    title: { en: "AI Disclosure Signer", id: "Penanda Tangan Pengungkapan AI" },
    desc: {
      en: "Batch-sign up to 50 JPG/PNG files with C2PA provenance and honest AI disclosure.",
      id: "Tandatangani hingga 50 file JPG/PNG dengan asal C2PA dan pengungkapan AI yang jujur.",
    },
    badge: { en: "1 credit / file", id: "1 kredit / file" },
    icon: FileSignature,
  },
];

const FAQS = [
  {
    q: "Do my files leave my device when using the free check tools?",
    a: "No. All five free check tools run locally in your browser using WebAssembly (@contentauth/c2pa-web). Files are never uploaded during inspection.",
  },
  {
    q: "Is this an AI detector or a watermark remover?",
    a: "No. This product never removes, alters, or hides C2PA credentials, SynthID, or IPTC AI fields, and it is not an AI detector. Missing credentials only mean no declaration was found.",
  },
  {
    q: "How does batch signing work?",
    a: "Upload up to 50 JPG or PNG files, attach your self-declared creator name, website, and honest AI-use disclosure, and download signed files individually or as a ZIP.",
  },
  {
    q: "What happens if a file already has Content Credentials?",
    a: "Existing valid credentials are preserved as a parent ingredient in the new manifest chain. If existing credentials fail validation, signing is blocked.",
  },
];

export default function ToolsLandingPage() {
  const { locale, t } = useLanguage();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="space-y-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="rounded-2xl bg-[var(--color-midnight)] text-white p-8 sm:p-12 space-y-6">
        <span className="inline-block rounded-full bg-[var(--color-blue)]/20 border border-[var(--color-electric)]/40 px-3 py-1 text-xs font-semibold text-[#8EC5FF]">
          {t.tools.badge}
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-3xl">
          {t.tools.heroTitle}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          {t.tools.heroSubtitle}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href="/tools/content-credentials-check"
            className="rounded-lg bg-[var(--color-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-electric)]"
          >
            {t.tools.ctaPrimary}
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t.tools.ctaSecondary}
          </Link>
        </div>
      </section>

      {/* Tool cards */}
      <section aria-label="Available tools" className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOL_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-3 hover:border-[var(--color-blue)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-blue)]">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                    {card.badge[locale]}
                  </span>
                </div>
                <h3 className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-blue)]">
                  {card.title[locale]}
                </h3>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  {card.desc[locale]}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">
          {t.tools.howItWorksTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Inspect locally for free",
              body: "Drop any image, video, or PDF into a checker tool. WebAssembly reads C2PA manifests on your device.",
            },
            {
              step: "2",
              title: "Declare AI use honestly",
              body: "Choose how AI was used, attach your self-declared creator name, and keep any valid parent credentials intact.",
            },
            {
              step: "3",
              title: "Sign & share proof",
              body: "Download C2PA-signed files individually or as a ZIP, and optionally publish a revocable public proof page.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-2"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-navy)] text-white text-xs font-bold">
                {item.step}
              </span>
              <h3 className="font-semibold text-sm text-[var(--color-ink)]">{item.title}</h3>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What results can and cannot prove */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 sm:p-8 space-y-5">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">
          {t.tools.whatItProvesTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-[#16865B] flex items-center gap-2">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              What it can show
            </h3>
            <ul className="space-y-2 text-xs text-[var(--color-ink)]">
              {t.tools.whatItProvesYes.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-[#C78316] flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="h-4 w-4" />
              What it cannot prove
            </h3>
            <ul className="space-y-2 text-xs text-[var(--color-ink)]">
              {t.tools.whatItProvesNo.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[var(--color-ink)]">
            {t.tools.pricingTitle}
          </h2>
          <Link
            href="/pricing"
            className="text-sm font-medium text-[var(--color-blue)] hover:underline"
          >
            See full pricing
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-2"
            >
              <h3 className="font-semibold text-[var(--color-ink)]">{pack.name}</h3>
              <p className="text-2xl font-bold text-[var(--color-midnight)]">
                ${(pack.amountCents / 100).toFixed(0)}{" "}
                <span className="text-xs font-normal text-[var(--color-muted)]">
                  / {pack.credits} credits
                </span>
              </p>
              <p className="text-xs text-[var(--color-muted)]">{pack.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">
          {t.tools.faqTitle}
        </h2>
        <div className="space-y-3">
          {FAQS.map((item, idx) => (
            <details
              key={idx}
              className="rounded-xl border border-[var(--color-border)] bg-white p-4"
            >
              <summary className="cursor-pointer font-semibold text-sm text-[var(--color-ink)]">
                {item.q}
              </summary>
              <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl bg-[var(--color-navy)] text-white p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Ready to check or sign your media?</h2>
          <p className="text-xs text-slate-300">
            Free checks require no account. Sign in to batch-sign up to 50 files at a time.
          </p>
        </div>
        <Link
          href="/tools/ai-disclosure-signer"
          className="rounded-lg bg-[var(--color-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-electric)]"
        >
          Open AI Disclosure Signer
        </Link>
      </section>
    </div>
  );
}
