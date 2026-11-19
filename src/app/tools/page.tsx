import type { Metadata } from "next";
import { ToolsHomeClient } from "@/components/ToolsHomeClient";
import { getFaqEntries } from "@/content/site-content";

export const metadata: Metadata = {
  title: "JingleStudio Tools — Know What's Inside Your Media",
  description:
    "Inspect image and video files, review embedded EXIF/IPTC/XMP metadata, verify C2PA Content Credentials, and clean personal metadata with a privacy-first workflow.",
  alternates: {
    canonical: "/tools",
  },
};

export default function ToolsHomePage() {
  const faqs = getFaqEntries().slice(0, 5);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q.en,
      acceptedAnswer: { "@type": "Answer", text: f.a.en },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <ToolsHomeClient />
    </>
  );
}
