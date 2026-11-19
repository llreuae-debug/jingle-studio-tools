import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "@/components/VerifyClient";

export const metadata: Metadata = {
  title: "Verify Content Credentials",
  description:
    "Inspect C2PA Content Credentials, signer certificates, and ingredient history locally in your browser or by URL.",
  alternates: { canonical: "/verify" },
};

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-slate-500">
          Loading Content Credentials Checker…
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
