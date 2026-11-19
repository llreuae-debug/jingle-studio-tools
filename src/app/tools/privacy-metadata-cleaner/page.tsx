import type { Metadata } from "next";
import { MediaInspectorWorkbench } from "@/components/MediaInspectorWorkbench";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Privacy Metadata Cleaner — JingleStudio Tools",
  description:
    "Remove personal GPS coordinates and EXIF metadata into a separate privacy-cleaned copy while preserving C2PA Content Credentials.",
  alternates: { canonical: "/tools/privacy-metadata-cleaner" },
};

export default function PrivacyMetadataCleanerPage() {
  return (
    <ToolPageShell
      currentHref="/tools/privacy-metadata-cleaner"
      badge="Preserves C2PA Provenance"
      title="Privacy Metadata Cleaner"
      description="Inspect personal metadata locally and generate a separate privacy-cleaned copy with GPS and EXIF device tags removed while keeping C2PA Content Credentials intact."
    >
      <MediaInspectorWorkbench mode="privacy" />
    </ToolPageShell>
  );
}
