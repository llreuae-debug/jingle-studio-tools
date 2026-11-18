import { Suspense } from "react";
import { VerifyClient } from "@/components/VerifyClient";

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
