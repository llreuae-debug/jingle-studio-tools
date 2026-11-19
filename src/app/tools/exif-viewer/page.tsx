import type { Metadata } from "next";
import { ExifViewerTool } from "@/components/ImageUtilityTools";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Image EXIF Viewer — JingleStudio Tools",
  description:
    "Inspect camera make, model, software, capture timestamps, and GPS coordinates in PNG, JPG, and WebP images locally in your browser.",
  alternates: { canonical: "/tools/exif-viewer" },
};

export default function ExifViewerPage() {
  return (
    <ToolPageShell
      currentHref="/tools/exif-viewer"
      badge="Local Browser EXIF & GPS Reader"
      title="Image EXIF Viewer"
      description="Inspect embedded EXIF camera tags, editing software, timestamps, and GPS location data directly in your browser with JSON copy and export."
    >
      <ExifViewerTool />
    </ToolPageShell>
  );
}
