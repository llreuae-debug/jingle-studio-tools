import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { AppFooter, AppHeader } from "@/components/AppChrome";
import { LanguageProvider } from "@/components/LanguageProvider";
import { MeshFlow } from "@/components/MeshFlow";
import { auth } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Jingle Studio Tools — Content Credentials & Honest AI Disclosure",
    template: "%s | Jingle Studio Tools",
  },
  description:
    "Free in-browser C2PA Content Credentials checker, Instagram & TikTok format fit tools, and batch AI-disclosure signing.",
  openGraph: {
    title: "Jingle Studio Tools — Content Credentials & Honest AI Disclosure",
    description:
      "Verify provenance locally in your browser or batch-sign media with honest C2PA AI disclosures.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("jingle_lang")?.value;
  const initialLocale: Locale = langCookie === "id" ? "id" : "en";

  const session = await auth();
  const userEmail = session?.user?.email || null;
  const userRole = (session?.user as { role?: string } | undefined)?.role || null;

  return (
    <html lang={initialLocale} className={inter.variable}>
      <body className="relative min-h-screen flex flex-col bg-[var(--cream)] text-[var(--plum)] antialiased">
        <MeshFlow />
        <LanguageProvider initialLocale={initialLocale}>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <AppHeader userEmail={userEmail} userRole={userRole} />
          <main id="main-content" className="relative z-10 flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
            {children}
          </main>
          <AppFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
