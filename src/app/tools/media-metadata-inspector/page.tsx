import type { Metadata } from "next";
import { MediaInspectorWorkbench } from "@/components/MediaInspectorWorkbench";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Media Metadata Inspector — JingleStudio Tools",
  description:
    "Inspect PNG, JPG, WebP, MP4, MOV, and WebM headers, EXIF/IPTC/XMP metadata, C2PA Content Credentials, and file integrity locally in your browser.",
  alternates: { canonical: "/tools/media-metadata-inspector" },
};

export default function MediaMetadataInspectorPage() {
  return (
    <ToolPageShell
      currentHref="/tools/media-metadata-inspector"
      badge="8-Category Local Inspector"
      title="Media Metadata Inspector"
      description="Inspect embedded EXIF, IPTC, XMP, C2PA Content Credentials, container streams, and file integrity directly in your browser without uploading files."
    >
      <MediaInspectorWorkbench mode="inspector" />
    </ToolPageShell>
  );
}
