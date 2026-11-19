import type { Metadata } from "next";
import { MediaInspectorWorkbench } from "@/components/MediaInspectorWorkbench";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Media Inspection Report Generator — JingleStudio Tools",
  description:
    "Generate downloadable JSON and PDF 1.4 media inspection reports covering file info, EXIF, IPTC/XMP, C2PA credentials, and integrity checks.",
  alternates: { canonical: "/tools/report-generator" },
};

export default function ReportGeneratorPage() {
  return (
    <ToolPageShell
      currentHref="/tools/report-generator"
      badge="JSON & PDF 1.4 Export"
      title="Media Inspection Report Generator"
      description="Inspect any supported image or video and export a structured JSON or human-readable PDF 1.4 report locally in your browser."
    >
      <MediaInspectorWorkbench mode="report" />
    </ToolPageShell>
  );
}
