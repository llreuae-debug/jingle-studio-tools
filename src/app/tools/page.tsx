"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { CredentialsResultCard } from "@/components/CredentialsResultCard";
import { useLanguage } from "@/components/LanguageProvider";
import { CREDIT_PACKS } from "@/config/pricing";
import { getFaqEntries } from "@/content/site-content";
import { inspectBlob, type InspectionResult } from "@/lib/c2pa-inspect";
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
    eyebrow: "Content Credentials tools",
    headline: "Know what your file says before you post it.",
    subhead:
      "Check the provenance inside your images and videos, label AI use honestly, and share proof people can inspect.",
    dropTitle: "Drop a file to check it",
    dropHint: "Click to choose or paste. Checks run in your browser.",
    btnCheck: "Check a file",
    btnSign: "Sign your work",
    storyTitle: "Every file has a story. Make yours clear.",
    storyCards: [
      {
        title: "Who signed it",
        body: "See the signer, signing time and whether the signer is recognized.",
      },
      {
        title: "How it was made",
        body: "See the app or device, recorded edits and source files.",
      },
      {
        title: "Where AI was used",
        body: "See any AI use declared in the file's credentials.",
      },
    ],
    reportTitle: "A report anyone can understand.",
    reportNote: "This report shows what the file declares. It does not prove what the image shows.",
    howTitle: "Three steps to a clearer file.",
    howSteps: [
      { n: "1", title: "Check", body: "Drop in a file and read its credentials." },
      { n: "2", title: "Disclose", body: "Tell us how AI was used, in plain language." },
      {
        n: "3",
        title: "Share",
        body: "Download the signed file and publish a proof page if you want one.",
      },
    ],
    whoTitle: "Who it is for",
    whoCards: [
      {
        title: "Real estate marketers",
        body: "Label renders and show which listing media was AI-assisted.",
      },
      {
        title: "Agencies",
        body: "Deliver client work with a clear record and a consistent brand profile.",
      },
      {
        title: "Creators",
        body: "Add your name and an honest AI disclosure to your work.",
      },
    ],
    pricingTitle: "Check free. Pay when you sign.",
    pricingTiers: [
      {
        name: "Free",
        price: "$0",
        body: "Unlimited browser checks, all platform checks, format checks, disclosure captions.",
      },
      {
        name: "Credits",
        price: `From $${(CREDIT_PACKS[0].amountCents / 100).toFixed(0)}`,
        body: "Batch signing, brand profiles, signed downloads, public proof pages.",
      },
      {
        name: "Team",
        price: "Included",
        body: "Shared workspace, roles, shared credits, API access.",
      },
    ],
    startFree: "Start free",
    seePricing: "See pricing",
    privacyTitle: "Privacy facts",
    privacyItems: [
      { title: "Checks", body: "Files are read in your browser and are not uploaded." },
      {
        title: "Signing",
        body: "Files are uploaded for processing, then deleted on the stated schedule.",
      },
      { title: "Your history", body: "Existing credentials are kept, never removed." },
    ],
    ctaHeadline: "Publish with nothing to hide.",
    ctaSubhead: "Check your file, disclose AI use and share the record.",
    faqTitle: "Frequently asked questions",
    seeAllFaq: "See all FAQ",
  },
  id: {
    eyebrow: "Alat Kredensial Konten",
    headline: "Ketahui isi file Anda sebelum mempostingnya.",
    subhead:
      "Periksa asal media di dalam gambar dan video Anda, beri label penggunaan AI secara jujur, dan bagikan bukti yang dapat diperiksa.",
    dropTitle: "Letakkan file untuk diperiksa",
    dropHint: "Klik untuk memilih atau tempel. Pemeriksaan berjalan di browser Anda.",
    btnCheck: "Periksa file",
    btnSign: "Tandatangani karya",
    storyTitle: "Setiap file punya cerita. Buat milik Anda jelas.",
    storyCards: [
      {
        title: "Siapa yang menandatangani",
        body: "Lihat penanda tangan, waktu penandatanganan, dan apakah penanda tangan dikenali.",
      },
      {
        title: "Bagaimana dibuatnya",
        body: "Lihat aplikasi atau perangkat, editan yang tercatat, dan file sumber.",
      },
      {
        title: "Di mana AI digunakan",
        body: "Lihat penggunaan AI apa pun yang dideklarasikan dalam kredensial file.",
      },
    ],
    reportTitle: "Laporan yang mudah dipahami siapa saja.",
    reportNote:
      "Laporan ini menunjukkan apa yang dideklarasikan file. Ini tidak membuktikan apa yang ditampilkan gambar.",
    howTitle: "Tiga langkah menuju file yang lebih jelas.",
    howSteps: [
      { n: "1", title: "Periksa", body: "Letakkan file dan baca kredensialnya." },
      { n: "2", title: "Ungkapkan", body: "Beri tahu bagaimana AI digunakan dengan bahasa sederhana." },
      {
        n: "3",
        title: "Bagikan",
        body: "Unduh file yang ditandatangani dan terbitkan halaman bukti jika diinginkan.",
      },
    ],
    whoTitle: "Untuk siapa alat ini",
    whoCards: [
      {
        title: "Pemasar properti",
        body: "Beri label render dan tunjukkan media listing mana yang dibantu AI.",
      },
      {
        title: "Agensi",
        body: "Serahkan pekerjaan klien dengan catatan jelas dan profil merek yang konsisten.",
      },
      {
        title: "Kreator",
        body: "Tambahkan nama Anda dan pengungkapan AI yang jujur pada karya Anda.",
      },
    ],
    pricingTitle: "Periksa gratis. Bayar saat menandatangani.",
    pricingTiers: [
      {
        name: "Gratis",
        price: "$0",
        body: "Pemeriksaan browser tanpa batas, semua pemeriksaan platform, cek format, takarir pengungkapan.",
      },
      {
        name: "Kredit",
        price: `Mulai $${(CREDIT_PACKS[0].amountCents / 100).toFixed(0)}`,
        body: "Penandatanganan batch, profil merek, unduhan bertanda tangan, halaman bukti publik.",
      },
      {
        name: "Tim",
        price: "Termasuk",
        body: "Ruang kerja bersama, peran, kredit bersama, akses API.",
      },
    ],
    startFree: "Mulai gratis",
    seePricing: "Lihat harga",
    privacyTitle: "Fakta privasi",
    privacyItems: [
      { title: "Pemeriksaan", body: "File dibaca di browser Anda dan tidak diunggah." },
      {
        title: "Penandatanganan",
        body: "File diunggah untuk diproses, lalu dihapus sesuai jadwal yang ditentukan.",
      },
      { title: "Riwayat Anda", body: "Kredensial yang ada dipertahankan, tidak pernah dihapus." },
    ],
    ctaHeadline: "Terbitkan tanpa ada yang disembunyikan.",
    ctaSubhead: "Periksa file Anda, ungkapkan penggunaan AI, dan bagikan catatannya.",
    faqTitle: "Pertanyaan yang sering diajukan",
    seeAllFaq: "Lihat semua FAQ",
  },
};

export default function ToolsHomePage() {
  const { locale } = useLanguage();
  const c = HOME_COPY[locale];
  const faqs = getFaqEntries().slice(0, 5);

  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickResult, setQuickResult] = useState<InspectionResult | null>(null);
  const [quickStage, setQuickStage] = useState<"idle" | "reading" | "checking">("idle");
  const [exampleReport, setExampleReport] = useState<ExampleReport | null>(null);

  useEffect(() => {
    fetch("/api/example-report")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setExampleReport(d);
      })
      .catch(() => {});
  }, []);

  const inspectFile = async (file?: File | null) => {
    if (!file) return;
    setQuickStage("reading");
    try {
      const res = await inspectBlob(file, file.name, (stage) => {
        setQuickStage(stage);
      });
      setQuickResult((prev) => {
        prev?.cleanup();
        return res;
      });
    } finally {
      setQuickStage("idle");
    }
  };

  const resetQuickResult = () => {
    setQuickResult((prev) => {
      prev?.cleanup();
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) void inspectFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q[locale],
      acceptedAnswer: { "@type": "Answer", text: f.a[locale] },
    })),
  };

  return (
    <div className="space-y-20 sm:space-y-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* HERO */}
      <section className="pt-6 sm:pt-12 space-y-8 text-center">
        <div className="space-y-5">
          <span className="inline-flex items-center rounded-full bg-[var(--warm-peach)] border border-[var(--color-brand-line)] px-4 py-1.5 text-xs font-bold text-[var(--color-brand)]">
            {c.eyebrow}
          </span>
          <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-bold tracking-[-0.025em] leading-[1.1] max-w-4xl mx-auto text-[var(--espresso-black)] break-words">
            {c.headline}
          </h1>
          <p className="text-base sm:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto leading-[1.63]">
            {c.subhead}
          </p>
        </div>

        {/* Elevated Milky Frosted Drop Zone Card */}
        <div className="max-w-4xl mx-auto rounded-[24px] border border-[var(--card-border-milky)] bg-white/90 backdrop-blur-[24px] p-4 sm:p-6 shadow-[var(--shadow-5)] text-left space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void inspectFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="rounded-[16px] border-2 border-dashed border-[var(--solar-orange)]/35 bg-[var(--warm-peach)]/45 hover:bg-[var(--warm-peach)]/80 p-8 sm:p-10 text-center cursor-pointer transition-colors duration-150"
          >
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--solar-orange)] text-[var(--espresso-black)] shadow-[var(--shadow-2)]">
              <Upload aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-[var(--espresso-black)]">
              {quickStage === "reading"
                ? "Reading file…"
                : quickStage === "checking"
                  ? "Checking credentials…"
                  : c.dropTitle}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{c.dropHint}</p>
            <label htmlFor={fileInputId} className="visually-hidden">
              {c.dropTitle}
            </label>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              className="visually-hidden"
              accept="image/*,video/mp4,video/quicktime,application/pdf"
              onChange={(e) => void inspectFile(e.target.files?.[0])}
            />
          </div>

          {quickResult && (
            <CredentialsResultCard result={quickResult} onReset={resetQuickResult} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link href="/tools/content-credentials-check" className="btn-plum px-6 py-3 text-sm font-semibold">
            {c.btnCheck}
          </Link>
          <Link
            href="/tools/ai-disclosure-signer"
            className="btn-mint px-6 py-3 text-sm font-semibold"
          >
            {c.btnSign}
          </Link>
        </div>
      </section>

      {/* WHAT YOUR FILE CAN TELL PEOPLE */}
      <section className="space-y-6">
        <h2 className="text-3xl sm:text-[42px] lg:text-[48px] font-bold tracking-[-0.025em] leading-[1.08] text-[var(--espresso-black)]">
          {c.storyTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.storyCards.map((card) => (
            <div
              key={card.title}
              onPointerMove={handleCardPointerMove}
              className="glass-surface glass-card-interactive p-6 space-y-2.5"
            >
              <h3 className="text-xl font-bold text-[var(--espresso-black)]">{card.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EXAMPLE REPORT */}
      <section className="card-dark p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl sm:text-[32px] font-bold tracking-[-0.015em] leading-[1.15] text-white">
            {c.reportTitle}
          </h2>
          <span className="rounded-full bg-[var(--solar-orange)] px-3.5 py-1 text-xs font-bold text-[var(--espresso-black)]">
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
              <dt className="font-semibold text-[#d6cdc5]">{k}</dt>
              <dd className="font-medium text-white">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-[#d6cdc5]">{c.reportNote}</p>
      </section>

      {/* HOW IT WORKS */}
      <section className="space-y-6">
        <h2 className="text-3xl sm:text-[42px] lg:text-[48px] font-bold tracking-[-0.025em] leading-[1.08] text-[var(--espresso-black)]">
          {c.howTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.howSteps.map((s) => (
            <div key={s.n} className="glass-surface p-6 space-y-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--solar-orange)] text-[var(--espresso-black)] text-xs font-bold shadow-[var(--shadow-1)]">
                {s.n}
              </span>
              <h3 className="font-bold text-lg text-[var(--espresso-black)]">{s.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT IS FOR */}
      <section className="space-y-6">
        <h2 className="text-3xl sm:text-[42px] lg:text-[48px] font-bold tracking-[-0.025em] leading-[1.08] text-[var(--espresso-black)]">
          {c.whoTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.whoCards.map((w) => (
            <div key={w.title} className="glass-surface p-6 space-y-2.5">
              <h3 className="font-bold text-lg text-[var(--espresso-black)]">{w.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="space-y-6">
        <h2 className="text-3xl sm:text-[42px] lg:text-[48px] font-bold tracking-[-0.025em] leading-[1.08] text-[var(--espresso-black)]">
          {c.pricingTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.pricingTiers.map((tier) => (
            <div key={tier.name} className="glass-surface p-6 space-y-2.5">
              <h3 className="font-bold text-lg text-[var(--espresso-black)]">{tier.name}</h3>
              <p className="text-2xl font-bold text-[var(--espresso-black)]">{tier.price}</p>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{tier.body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="btn-plum px-6 py-2.5 text-sm font-semibold">
            {c.startFree}
          </Link>
          <Link href="/pricing" className="btn-mint px-6 py-2.5 text-sm font-semibold">
            {c.seePricing}
          </Link>
        </div>
      </section>

      {/* PRIVACY FACTS */}
      <section className="glass-surface p-6 sm:p-8 space-y-5">
        <h2 className="text-2xl sm:text-[32px] font-bold tracking-[-0.015em] leading-[1.15] text-[var(--espresso-black)]">
          {c.privacyTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {c.privacyItems.map((p) => (
            <div
              key={p.title}
              className="rounded-[16px] bg-[var(--warm-peach)]/65 border border-[var(--color-brand-line)] p-5 space-y-1.5"
            >
              <h3 className="font-bold text-base text-[var(--espresso-black)]">{p.title}</h3>
              <p className="text-xs text-[var(--espresso-black)] leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TOP 5 FAQ */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-3xl sm:text-[42px] lg:text-[48px] font-bold tracking-[-0.025em] leading-[1.08] text-[var(--espresso-black)]">
            {c.faqTitle}
          </h2>
          <Link href="/faq" className="text-sm font-semibold text-[var(--color-brand)] hover:underline shrink-0">
            {c.seeAllFaq}
          </Link>
        </div>
        <div className="space-y-3">
          {faqs.map((item, idx) => (
            <details key={idx} className="glass-surface p-5 sm:p-6">
              <summary className="cursor-pointer font-semibold text-sm text-[var(--espresso-black)]">
                {item.q[locale]}
              </summary>
              <p className="mt-2.5 text-sm text-[var(--color-text-muted)] leading-relaxed">
                {item.a[locale]}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section
        className="rounded-[28px] p-8 sm:p-12 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-[var(--shadow-dark-card)]"
        style={{
          background: "linear-gradient(135deg, #141312 0%, #c93700 58%, #ff5500 100%)",
        }}
      >
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-[32px] font-bold tracking-[-0.015em] text-white">
            {c.ctaHeadline}
          </h2>
          <p className="text-sm text-[#fae6da]">{c.ctaSubhead}</p>
        </div>
        <Link
          href="/tools/content-credentials-check"
          className="rounded-full bg-white text-[var(--espresso-black)] hover:bg-[var(--warm-peach)] px-6 py-3 text-sm font-bold shadow-[var(--shadow-2)] shrink-0 transition-colors duration-150"
        >
          {c.btnCheck}
        </Link>
      </section>
    </div>
  );
}
