import type { Metadata } from "next";
import { ImageConverterTool } from "@/components/ImageUtilityTools";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Image Format Converter — JingleStudio Tools",
  description:
    "Convert PNG, JPEG, and WebP images locally in your browser using HTML5 Canvas with quality and JPEG background fill controls.",
  alternates: { canonical: "/tools/image-converter" },
};

export default function ImageConverterPage() {
  return (
    <ToolPageShell
      currentHref="/tools/image-converter"
      badge="Client-Side PNG / JPG / WebP"
      title="Image Format Converter"
      description="Convert images between PNG, JPEG, and WebP directly in your browser. Your original file is never uploaded or overwritten."
    >
      <ImageConverterTool />
    </ToolPageShell>
  );
}
