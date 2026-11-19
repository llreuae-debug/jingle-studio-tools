import { Suspense } from "react";
import { LoginClient } from "@/components/LoginClient";
import { isGoogleSignInConfigured } from "@/lib/auth";

export const metadata = {
  title: "Sign in",
  description: "Sign in with Google or email to manage Content Credentials and batch signing.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const googleEnabled = isGoogleSignInConfigured();

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[var(--plum-muted)]">Loading…</div>
      }
    >
      <LoginClient googleEnabled={googleEnabled} />
    </Suspense>
  );
}
