import { renderBrandOgImage } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "Learn — Jingle Studio Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function LearnOgImage() {
  return renderBrandOgImage({
    eyebrow: "Learn",
    title: "Content Credentials & Honest AI Disclosure",
    subtitle: "Plain-language guides on C2PA provenance, SynthID, and platform rules.",
  });
}
