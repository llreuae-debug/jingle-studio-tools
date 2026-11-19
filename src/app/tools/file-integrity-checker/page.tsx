import type { Metadata } from "next";
import { FileIntegrityTool } from "@/components/ImageUtilityTools";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "File Integrity Checker — JingleStudio Tools",
  description:
    "Verify media magic-byte signatures, extension matches, polyglot header safety, container structure, and SHA-256 checksums locally.",
  alternates: { canonical: "/tools/file-integrity-checker" },
};

export default function FileIntegrityCheckerPage() {
  return (
    <ToolPageShell
      currentHref="/tools/file-integrity-checker"
      badge="SHA-256 & Container Validation"
      title="File Integrity Checker"
      description="Verify magic-byte headers, extension consistency, container structure, pixel decode health, and compare SHA-256 checksums locally."
    >
      <FileIntegrityTool />
    </ToolPageShell>
  );
}
