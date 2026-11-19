import type { Metadata } from "next";
import { FaqClient } from "@/components/FaqClient";
import { getFaqEntries } from "@/content/site-content";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Plain answers about C2PA Content Credentials, Google SynthID, privacy cleaning, and platform AI labels.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FaqPage() {
  const entries = getFaqEntries();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((f) => ({
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
      <FaqClient />
    </>
  );
}
