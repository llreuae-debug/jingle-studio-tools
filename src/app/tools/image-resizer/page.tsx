import type { Metadata } from "next";
import { ImageResizerTool } from "@/components/ImageUtilityTools";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Image Resizer — JingleStudio Tools",
  description:
    "Resize PNG, JPEG, and WebP images to exact pixel dimensions or social presets with aspect-ratio lock in your browser.",
  alternates: { canonical: "/tools/image-resizer" },
};

export default function ImageResizerPage() {
  return (
    <ToolPageShell
      currentHref="/tools/image-resizer"
      badge="Client-Side Dimension Editor"
      title="Image Resizer"
      description="Resize PNG, JPEG, and WebP images to exact pixel dimensions or presets with optional aspect-ratio locking."
    >
      <ImageResizerTool />
    </ToolPageShell>
  );
}
