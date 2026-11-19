import { MessageCircle } from "lucide-react";

export const metadata = {
  title: "Contact",
  description: "Contact Jingle Studio Tools via email or WhatsApp.",
  alternates: { canonical: "/contact" },
};

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "923138654411";

export default function ContactPage() {
  return (
    <div className="max-w-2xl glass-surface p-6 sm:p-8 space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--plum)]">Contact</h1>
      <p className="text-sm text-[var(--plum-muted)]">
        Questions about Content Credentials, team workspaces, or manual bank transfers? Reach our
        team directly.
      </p>
      <div className="space-y-3 text-sm">
        <p>
          Email:{" "}
          <a href="mailto:info@jinglestudio.io" className="font-semibold text-[var(--plum)] underline">
            info@jinglestudio.io
          </a>
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 btn-lime px-5 py-2.5 text-xs font-semibold"
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
