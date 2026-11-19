import type { Metadata } from "next";
import { ImageCompressorTool } from "@/components/ImageUtilityTools";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Image Compression Tool — JingleStudio Tools",
  description:
    "Compress JPEG and WebP images locally in your browser with quality controls, max-width scaling, and live byte savings.",
  alternates: { canonical: "/tools/image-compressor" },
};

export default function ImageCompressorPage() {
  return (
    <ToolPageShell
      currentHref="/tools/image-compressor"
      badge="Client-Side Size Optimizer"
      title="Image Compression Tool"
      description="Reduce image file sizes locally in your browser using JPEG or WebP quality tuning and optional max-width scaling."
    >
      <ImageCompressorTool />
    </ToolPageShell>
  );
}
