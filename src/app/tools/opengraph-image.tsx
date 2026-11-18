import { renderBrandOgImage } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "Jingle Studio Tools — Content Credentials & AI Disclosure";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ToolsOgImage() {
  return renderBrandOgImage({
    eyebrow: "Content Credentials tools",
    title: "Know what your file says before you post it.",
    subtitle: "Check provenance locally in your browser, label AI use honestly, and share proof.",
  });
}
