import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { AppFooter, AppHeader } from "@/components/AppChrome";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SITE_CONFIG } from "@/config/site";
import { auth, getSessionContext } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE_CONFIG.themeColor },
    { media: "(prefers-color-scheme: dark)", color: SITE_CONFIG.themeColor },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.siteUrl),
  applicationName: SITE_CONFIG.name,
  title: {
    default: `${SITE_CONFIG.name} — Content Credentials & Honest AI Disclosure`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE_CONFIG.shortName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: `${SITE_CONFIG.name} — Content Credentials & Honest AI Disclosure`,
    description: SITE_CONFIG.description,
    type: "website",
    url: SITE_CONFIG.siteUrl,
    images: [
      {
        url: `${SITE_CONFIG.siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: SITE_CONFIG.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_CONFIG.name} — Content Credentials & Honest AI Disclosure`,
    description: SITE_CONFIG.description,
    images: [`${SITE_CONFIG.siteUrl}/twitter-image.png`],
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

  const [ctx, session] = await Promise.all([getSessionContext(), auth()]);
  const userEmail = ctx?.user.email || session?.user?.email || null;
  const userName = ctx?.user.name || session?.user?.name || null;
  const userImage = ctx?.user.avatarUrl || session?.user?.image || null;
  const userRole =
    ctx?.user.role || (session?.user as { role?: string } | undefined)?.role || null;

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.siteUrl,
    logo: `${SITE_CONFIG.siteUrl}/brand/logo-square-512.png`,
  };

  return (
    <html lang={initialLocale} className={inter.variable}>
      <head>
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color={SITE_CONFIG.themeColor} />
        <meta name="msapplication-TileColor" content={SITE_CONFIG.themeColor} />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="relative min-h-screen flex flex-col bg-[var(--background)] text-[var(--color-ink)] antialiased">
        <LanguageProvider initialLocale={initialLocale}>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <AppHeader
            userEmail={userEmail}
            userName={userName}
            userImage={userImage}
            userRole={userRole}
          />
          <main id="main-content" className="relative z-10 flex-1 mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            {children}
          </main>
          <AppFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
