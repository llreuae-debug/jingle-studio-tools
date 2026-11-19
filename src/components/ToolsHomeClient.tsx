"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { MediaInspectorWorkbench } from "@/components/MediaInspectorWorkbench";
import { CREDIT_PACKS } from "@/config/pricing";
import {
  CORE_TOOLS,
  SPECIALIZED_TOOLS,
  type ToolCategory,
} from "@/config/tools-catalog";
import { getFaqEntries } from "@/content/site-content";
import { handleCardPointerMove } from "@/lib/pointer-glow";

interface ExampleReport {
  label: string;
  credentialsStatus: string;
  signer: string;
  signedOn: string;
  appOrDevice: string;
  actions: string;
  ingredients: string;
  aiInformation: string;
}

const HOME_COPY = {
  en: {
    brandHeading: "JingleStudio Tools",
    badge: "Privacy-First Media Inspector & Utilities",
    headline: "Know What's Inside Your Media.",
    subhead:
      "Inspect image and video files, review embedded metadata, and understand their content credentials with a privacy-first workflow.",
    platformDisclaimer:
      "Note: Checking credentials or removing personal metadata protects your privacy but does not stop Instagram, TikTok, Facebook, YouTube, or X from identifying AI media.",
    btnCheck: "Open full C2PA checker",
    btnSign: "Sign & disclose work",
    storyTitle: "Every file has a story. Make yours clear.",
    storyCards: [
      {
        title: "C2PA Content Credentials",
        body: "See the signer, signing time, verification status, and whether the issuer is recognized — preserved intact.",
      },
      {
        title: "EXIF, GPS & Video Metadata",
        body: "Inspect camera model, lens, encoder, codec, frame rate, and hidden GPS coordinates before posting.",
      },
      {
        title: "Privacy-Safe Cleaning",
        body: "Losslessly strip personal GPS and unnecessary EXIF tags while keeping image/video quality and provenance.",
      },
    ],
    reportTitle: "A report anyone can understand.",
    reportNote:
      "This report shows what the file declares. It does not prove what the image shows.",
    howTitle: "Three steps to a cleaner, clearer file.",
    howSteps: [
      {
        n: "1",
        title: "Inspect",
        body: "Drop an image or video to inspect C2PA credentials, SynthID info, and embedded metadata.",
      },
      {
        n: "2",
        title: "Clean privacy metadata",
        body: "Selectively remove GPS coordinates, camera serials, and non-essential personal tags losslessly.",
      },
      {
        n: "3",
        title: "Download & verify",
        body: "Download your privacy-cleaned file or keep an honest C2PA signed record.",
      },
    ],
    whoTitle: "Who it is for",
    whoCards: [
      {
        title: "Real estate marketers",
        body: "Remove client home GPS coordinates before sharing property visuals and disclose AI assistance honestly.",
      },
      {
        title: "Agencies",
        body: "Deliver client campaigns with clean privacy metadata and verifiable C2PA attribution.",
      },
      {
        title: "Creators",
        body: "Check Content Credentials before posting on Instagram or TikTok and keep personal capture info private.",
      },
    ],
    pricingTitle: "Inspect & clean free. Scale with credits.",
    pricingTiers: [
      {
        name: "Free",
        price: "$0",
        body: "Browser C2PA checks, metadata inspection, privacy cleaning up to 25 MB images & 100 MB videos.",
      },
      {
        name: "Credits & Pro",
        price: `From $${(CREDIT_PACKS[0].amountCents / 100).toFixed(0)}`,
        body: "Extended upload limits, 7-day history, batch C2PA signing, and public proof pages.",
      },
      {
        name: "Business & Team",
        price: "Included",
        body: "Shared workspace, team roles, REST API & MCP access, and shared credit billing.",
      },
    ],
    startFree: "Start free",
    seePricing: "See pricing",
    privacyTitle: "Privacy & transparency commitments",
    privacyItems: [
      {
        title: "Honest provenance",
        body: "C2PA credentials and original SynthID watermarks are never secretly stripped or spoofed.",
      },
      {
        title: "Automatic expiry",
        body: "Uploaded files processed on our servers are isolated per owner and purged automatically after expiry.",
      },
      {
        title: "Lossless output",
        body: "GPS & personal EXIF removal operates cleanly at container level to preserve media quality.",
      },
    ],
    ctaHeadline: "Publish with clean privacy and honest credentials.",
    ctaSubhead:
      "Inspect C2PA credentials, strip personal location metadata, and verify output before sharing.",
    faqTitle: "Frequently asked questions",
    seeAllFaq: "See all FAQ",
  },
  id: {
    brandHeading: "SynthID Remover",
    badge: "Inspektor Media AI & Pembersih Privasi",
    headline: "Periksa Gambar & Video AI Anda",
    subhead:
      "Pahami kredensial konten AI, periksa metadata tertanam, dan lindungi privasi Anda saat membagikan media AI.",
    platformDisclaimer:
      "Catatan: Pemeriksaan kredensial atau penghapusan metadata pribadi melindungi privasi Anda dan tidak mencegah Instagram, TikTok, Facebook, YouTube, atau X mengenali konten AI.",
    btnCheck: "Buka pemeriksa C2PA lengkap",
    btnSign: "Tandatangani karya",
    storyTitle: "Setiap file punya cerita. Buat milik Anda jelas.",
    storyCards: [
      {
        title: "Kredensial Konten C2PA",
        body: "Lihat penanda tangan, waktu penandatanganan, dan status verifikasi tanpa menghapus asal file.",
      },
      {
        title: "Metadata EXIF, GPS & Video",
        body: "Periksa model kamera, codec video, laju bingkai, dan koordinat GPS tersembunyi sebelum dibagikan.",
      },
      {
        title: "Pembersihan Aman Privasi",
        body: "Hapus GPS pribadi dan tag EXIF yang tidak perlu secara lossless sambil menjaga kualitas media.",
      },
    ],
    reportTitle: "Laporan yang mudah dipahami siapa saja.",
    reportNote:
      "Laporan ini menunjukkan apa yang dideklarasikan file. Ini tidak membuktikan apa yang ditampilkan gambar.",
    howTitle: "Tiga langkah menuju file yang lebih bersih.",
    howSteps: [
      {
        n: "1",
        title: "Periksa",
        body: "Letakkan gambar atau video untuk melihat kredensial C2PA, info SynthID, dan metadata.",
      },
      {
        n: "2",
        title: "Bersihkan metadata pribadi",
        body: "Hapus koordinat GPS, info kamera pribadi, dan tag EXIF non-esensial secara selektif.",
      },
      {
        n: "3",
        title: "Unduh & verifikasi",
        body: "Unduh file bersih privasi Anda atau simpan catatan bertanda tangan C2PA yang jujur.",
      },
    ],
    whoTitle: "Untuk siapa alat ini",
    whoCards: [
      {
        title: "Pemasar properti",
        body: "Hapus koordinat GPS lokasi properti pribadi dan beri label penggunaan AI secara jujur.",
      },
      {
        title: "Agensi",
        body: "Serahkan aset klien dengan metadata privasi bersih dan atribusi C2PA yang jelas.",
      },
      {
        title: "Kreator",
        body: "Periksa kredensial konten sebelum memposting di Instagram atau TikTok tanpa membocorkan lokasi.",
      },
    ],
    pricingTitle: "Periksa & bersihkan gratis.",
    pricingTiers: [
      {
        name: "Gratis",
        price: "$0",
        body: "Pemeriksaan browser C2PA, inspeksi metadata, dan pembersihan privasi gratis.",
      },
      {
        name: "Kredit & Pro",
        price: `Mulai $${(CREDIT_PACKS[0].amountCents / 100).toFixed(0)}`,
        body: "Batas ukuran lebih besar, riwayat 7 hari, penandatanganan batch, dan halaman bukti.",
      },
      {
        name: "Bisnis & Tim",
        price: "Termasuk",
        body: "Ruang kerja bersama, peran tim, dan akses REST API & MCP.",
      },
    ],
    startFree: "Mulai gratis",
    seePricing: "Lihat harga",
    privacyTitle: "Komitmen privasi & transparansi",
    privacyItems: [
      {
        title: "Asal yang jujur",
        body: "Kredensial C2PA dan sinyal SynthID asli tidak pernah dihapus secara diam-diam.",
      },
      {
        title: "Penghapusan otomatis",
        body: "File yang diproses di server diisolasi per pengguna dan dihapus otomatis setelah kedaluwarsa.",
      },
      {
        title: "Kualitas terjaga",
        body: "Pembersihan metadata terjadi di tingkat kontainer tanpa mengurangi kualitas gambar atau video.",
      },
    ],
    ctaHeadline: "Terbitkan dengan privasi bersih dan kredensial jujur.",
    ctaSubhead: "Periksa kredensial C2PA dan bersihkan metadata lokasi sebelum berbagi.",
    faqTitle: "Pertanyaan yang sering diajukan",
    seeAllFaq: "Lihat semua FAQ",
  },
};

function PlatformIconCluster() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center -space-x-2 align-middle mx-2"
    >
      <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#FF0000] text-white ring-2 ring-white shadow-sm text-[10px] font-extrabold">
        ▶
      </span>
      <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#1877F2] text-white ring-2 ring-white shadow-sm text-xs font-extrabold">
        f
      </span>
      <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#111111] text-white ring-2 ring-white shadow-sm text-[11px] font-extrabold">
        ♪
      </span>
      <span
        className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-white ring-2 ring-white shadow-sm text-[10px] font-extrabold"
        style={{
          background:
            "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
        }}
      >
        IG
      </span>
      <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#222226] text-white ring-2 ring-white shadow-sm text-[11px] font-extrabold">
        𝕏
      </span>
    </span>
  );
}

export function ToolsHomeClient() {
  const { locale } = useLanguage();
  const c = HOME_COPY[locale];
  const faqs = getFaqEntries().slice(0, 5);
  const [exampleReport, setExampleReport] = useState<ExampleReport | null>(null);
  const [toolFilter, setToolFilter] = useState<"all" | ToolCategory>("all");

  const filteredTools =
    toolFilter === "all"
      ? CORE_TOOLS
      : CORE_TOOLS.filter((tool) => tool.category === toolFilter);

  const handleInspectClick = () => {
    const el = document.getElementById("inspection-workspace");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const btn = el.querySelector<HTMLElement>("[role='button']");
      btn?.focus();
    }
  };

  useEffect(() => {
    fetch("/api/example-report")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setExampleReport(d);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24">

      {/* HERO */}
      <section className="pt-2 sm:pt-6 space-y-6 text-center">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm font-bold tracking-tight text-[var(--color-ink)]">
              {c.brandHeading}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] px-3 py-0.5 text-[11px] font-semibold text-[var(--color-brand)]">
              <ShieldCheck aria-hidden="true" className="h-3 w-3" />
              {c.badge}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-extrabold tracking-[-0.03em] leading-[1.1] max-w-4xl mx-auto text-[var(--color-ink)]">
            {c.headline}
            <PlatformIconCluster />
          </h1>

          <p className="text-base sm:text-[19px] text-[var(--color-text-muted)] max-w-2xl mx-auto leading-[1.6]">
            {c.subhead}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleInspectClick}
              className="btn-plum inline-flex min-h-[44px] items-center justify-center px-6 py-2.5 text-sm font-semibold"
            >
              Inspect Your File
            </button>
            <a
              href="#tools-dashboard"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)]"
            >
              Explore Tools
            </a>
          </div>
        </div>

        {/* Two-column AI Media Inspector & Privacy Cleaner Workbench */}
        <div id="inspection-workspace" className="text-left scroll-mt-6">
          <MediaInspectorWorkbench />
        </div>

        <p className="text-xs text-[var(--color-text-muted)] max-w-2xl mx-auto">
          {c.platformDisclaimer}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link href="/tools/content-credentials-check" className="btn-plum px-6 py-2.5 text-sm font-semibold">
            {c.btnCheck}
          </Link>
          <Link
            href="/tools/ai-disclosure-signer"
            className="btn-mint px-6 py-2.5 text-sm font-semibold"
          >
            {c.btnSign}
          </Link>
        </div>
      </section>

      {/* 10-TOOL DASHBOARD */}
      <section id="tools-dashboard" aria-label="Media Inspection and Utility Tools" className="space-y-6 scroll-mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-[36px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-ink)]">
              Media Inspection &amp; Utility Suite
            </h2>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              Every tool below runs real inspection, provenance verification, or client-side image processing.
            </p>
          </div>
          <div role="group" aria-label="Filter tools by category" className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: `All Tools (${CORE_TOOLS.length})` },
                { id: "inspection", label: "Inspection & Provenance" },
                { id: "privacy", label: "Privacy & Cleaning" },
                { id: "image", label: "Image Utilities" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={toolFilter === tab.id}
                onClick={() => setToolFilter(tab.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  toolFilter === tab.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    : "border-[var(--border)] bg-white text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              onPointerMove={handleCardPointerMove}
              className="glass-surface glass-card-interactive p-5 flex flex-col justify-between gap-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--color-brand-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-brand)]">
                    {tool.badge}
                  </span>
                  <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                    {tool.executionScope}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--color-ink)] group-hover:text-[var(--color-brand)]">
                  {tool.title}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {tool.description}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-[11px]">
                <span className="text-[var(--color-text-muted)]">{tool.formats}</span>
                <span className="font-semibold text-[var(--color-brand)]">Open tool →</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-[16px] border border-[var(--border)] bg-white p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Specialized Provenance &amp; Social Label Checkers
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SPECIALIZED_TOOLS.map((st) => (
              <Link
                key={st.href}
                href={st.href}
                className="rounded-[12px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3 text-xs hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand-soft)]"
              >
                <p className="font-bold text-[var(--color-ink)]">{st.title}</p>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)] line-clamp-2">{st.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="space-y-6">
        <h2 className="text-2xl sm:text-[36px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-ink)]">
          {c.storyTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.storyCards.map((card) => (
            <div
              key={card.title}
              onPointerMove={handleCardPointerMove}
              className="glass-surface glass-card-interactive p-6 space-y-2"
            >
              <h3 className="text-lg font-bold text-[var(--color-ink)]">{card.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EXAMPLE REPORT */}
      <section className="card-dark p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl sm:text-[30px] font-bold tracking-[-0.015em] text-white">
            {c.reportTitle}
          </h2>
          <span className="rounded-full bg-[var(--color-brand)] px-3.5 py-1 text-xs font-bold text-white">
            {exampleReport?.label || "Example file"}
          </span>
        </div>

        <dl className="divide-y divide-white/15 text-sm">
          {[
            ["Credentials status", exampleReport?.credentialsStatus || "Loading…"],
            ["Signer", exampleReport?.signer || "Loading…"],
            ["Signed on", exampleReport?.signedOn || "Loading…"],
            ["App or device", exampleReport?.appOrDevice || "Loading…"],
            ["Actions", exampleReport?.actions || "Loading…"],
            ["Ingredients", exampleReport?.ingredients || "Loading…"],
            ["AI information", exampleReport?.aiInformation || "Loading…"],
          ].map(([k, v]) => (
            <div key={k} className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="font-semibold text-[#c6c6d2]">{k}</dt>
              <dd className="font-medium text-white">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-[#c6c6d2]">{c.reportNote}</p>
      </section>

      {/* HOW IT WORKS */}
      <section className="space-y-6">
        <h2 className="text-2xl sm:text-[36px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-ink)]">
          {c.howTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.howSteps.map((s) => (
            <div key={s.n} className="glass-surface p-6 space-y-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand)] text-white text-xs font-bold">
                {s.n}
              </span>
              <h3 className="font-bold text-base text-[var(--color-ink)]">{s.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT IS FOR */}
      <section className="space-y-6">
        <h2 className="text-2xl sm:text-[36px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-ink)]">
          {c.whoTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.whoCards.map((w) => (
            <div key={w.title} className="glass-surface p-6 space-y-2">
              <h3 className="font-bold text-base text-[var(--color-ink)]">{w.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="space-y-6">
        <h2 className="text-2xl sm:text-[36px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-ink)]">
          {c.pricingTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.pricingTiers.map((tier) => (
            <div key={tier.name} className="glass-surface p-6 space-y-2.5">
              <h3 className="font-bold text-base text-[var(--color-ink)]">{tier.name}</h3>
              <p className="text-2xl font-bold text-[var(--color-ink)]">{tier.price}</p>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{tier.body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="btn-plum px-5 py-2.5 text-sm font-semibold">
            {c.startFree}
          </Link>
          <Link href="/pricing" className="btn-mint px-5 py-2.5 text-sm font-semibold">
            {c.seePricing}
          </Link>
        </div>
      </section>

      {/* PRIVACY COMMITMENTS */}
      <section className="glass-surface p-6 sm:p-8 space-y-5">
        <h2 className="text-2xl sm:text-[30px] font-bold tracking-[-0.015em] text-[var(--color-ink)]">
          {c.privacyTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.privacyItems.map((p) => (
            <div
              key={p.title}
              className="rounded-[14px] bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] p-4 space-y-1.5"
            >
              <h3 className="font-bold text-sm text-[var(--color-ink)]">{p.title}</h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TOP 5 FAQ */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-[36px] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
            {c.faqTitle}
          </h2>
          <Link href="/faq" className="text-sm font-semibold text-[var(--color-brand)] hover:underline shrink-0">
            {c.seeAllFaq}
          </Link>
        </div>
        <div className="space-y-3">
          {faqs.map((item, idx) => (
            <details key={idx} className="glass-surface p-5">
              <summary className="cursor-pointer font-semibold text-sm text-[var(--color-ink)]">
                {item.q[locale]}
              </summary>
              <p className="mt-2.5 text-sm text-[var(--color-text-muted)] leading-relaxed">
                {item.a[locale]}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA BANNER */}
      <section
        className="rounded-[20px] p-8 sm:p-10 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-[var(--shadow-dark-card)]"
        style={{
          background: "linear-gradient(135deg, #111116 0%, #4d2ee6 52%, #6c47ff 100%)",
        }}
      >
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-[30px] font-bold tracking-[-0.015em] text-white">
            {c.ctaHeadline}
          </h2>
          <p className="text-sm text-[#ebe6ff]">{c.ctaSubhead}</p>
        </div>
        <Link
          href="/tools/content-credentials-check"
          className="rounded-[12px] bg-white text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] px-5 py-2.5 text-sm font-bold shadow-[var(--shadow-2)] shrink-0 transition-colors duration-150"
        >
          {c.btnCheck}
        </Link>
      </section>
    </div>
  );
}
