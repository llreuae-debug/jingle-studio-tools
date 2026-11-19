import type { InspectionResult } from "@/lib/c2pa-inspect";
import type { LocalMediaInspection } from "@/lib/browser-media-inspector";

export interface ExportableInspectionReport {
  generatedAt: string;
  localInspection: LocalMediaInspection;
  c2paInspection: {
    status: InspectionResult["status"];
    title: string;
    subtitle: string;
    issuer: string | null;
    signingTime: string | null;
    claimGenerator: string | null;
    aiUseLabel: string;
    actionsCount: number;
    ingredientsCount: number;
    validationErrors: string[];
  } | null;
  synthIdSummary: {
    statusLabel: string;
    explanation: string;
  };
  privacyCleanSummary: {
    cleaned: boolean;
    removedFields: string[];
    preservedOriginalBytes: boolean;
    outputSha256: string | null;
    cleanedSizeBytes: number | null;
  } | null;
}

export function buildInspectionReportJson(report: ExportableInspectionReport): string {
  return JSON.stringify(
    {
      schemaVersion: "1.0",
      tool: "Jingle Studio Tools — Media Inspection Report",
      ...report,
    },
    null,
    2
  );
}

function sanitizePdfText(raw: string): string {
  // Restrict to safe ASCII and escape PDF string literals
  return raw
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(text: string, maxChars = 84): string[] {
  const clean = text.trim();
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ` ${w}`;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Builds a standards-compliant multi-page PDF 1.4 document with zero external dependencies.
 */
export function buildInspectionReportPdf(report: ExportableInspectionReport): Uint8Array {
  const { localInspection: li, c2paInspection: c2pa, synthIdSummary, privacyCleanSummary } = report;

  const lines: Array<{ text: string; bold?: boolean }> = [];
  const pushHeading = (title: string) => {
    lines.push({ text: "" });
    lines.push({ text: title, bold: true });
  };
  const pushRow = (label: string, val: string) => {
    for (const part of wrapLine(`${label}: ${val}`, 86)) {
      lines.push({ text: part });
    }
  };

  lines.push({ text: "Jingle Studio Tools - Media Inspection Report", bold: true });
  pushRow("Generated", report.generatedAt);

  pushHeading("1. Media File Information");
  pushRow("File Name", li.fileInfo.fileName);
  pushRow(
    "Format & MIME",
    `${li.fileInfo.detectedFormat} (${li.fileInfo.mimeType})`
  );
  pushRow("File Size", `${li.fileInfo.fileSizeBytes} bytes`);
  if (li.fileInfo.width && li.fileInfo.height) {
    pushRow("Dimensions", `${li.fileInfo.width} x ${li.fileInfo.height} px`);
  }
  if (li.fileInfo.durationSec !== undefined) {
    pushRow("Duration", `${li.fileInfo.durationSec}s`);
  }
  pushRow("Input SHA-256", li.fileInfo.sha256 || "Unavailable");

  pushHeading("2. File Integrity & Format Validation");
  pushRow("Integrity Status", li.integrity.status);
  pushRow("Magic Bytes Valid", li.integrity.magicBytesValid ? "Yes" : "No");
  pushRow(
    "Extension Matches Header",
    li.integrity.extensionMatchesHeader ? "Yes" : "No"
  );
  pushRow("Container Structure Valid", li.integrity.structureValid ? "Yes" : "No");
  if (li.integrity.pixelDecodeValid !== null) {
    pushRow("Browser Pixel Decode", li.integrity.pixelDecodeValid ? "Verified" : "Failed");
  }
  if (li.integrity.notes.length > 0) {
    pushRow("Notes", li.integrity.notes.join("; "));
  }

  pushHeading("3. EXIF Metadata");
  pushRow("EXIF Status", li.exif.status);
  pushRow("Camera", [li.exif.make, li.exif.model].filter(Boolean).join(" ") || "Not detected");
  pushRow("Lens", li.exif.lensModel || "Not detected");
  pushRow("Software", li.exif.editingSoftware || li.exif.software || "Not detected");
  pushRow("Creation Date", li.exif.dateTimeOriginal || li.exif.createDate || "Not detected");
  pushRow(
    "GPS Coordinates",
    li.exif.hasGps && li.exif.gps
      ? `Detected (${li.exif.gps.latitude ?? "?"}, ${li.exif.gps.longitude ?? "?"})`
      : "Not detected"
  );

  pushHeading("4. IPTC & XMP Metadata");
  pushRow("IPTC / XMP Status", li.iptcXmp.status);
  pushRow(
    "IPTC Segment",
    li.iptcXmp.hasIptc ? `${li.iptcXmp.iptcBytes ?? 0} bytes` : "Not detected"
  );
  pushRow(
    "XMP Fields",
    Object.keys(li.iptcXmp.xmp).length > 0
      ? Object.entries(li.iptcXmp.xmp)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      : "None"
  );

  pushHeading("5. C2PA Content Credentials & Provenance");
  if (c2pa) {
    pushRow("C2PA Card Title", c2pa.title);
    pushRow("Issuer / Signer", c2pa.issuer || "Not stated / Unrecognized");
    pushRow("Signed On", c2pa.signingTime || "Not available");
    pushRow("Made With", c2pa.claimGenerator || "Not stated");
    pushRow("AI Use Declared", c2pa.aiUseLabel);
    pushRow("Edit Actions / Ingredients", `${c2pa.actionsCount} / ${c2pa.ingredientsCount}`);
    if (c2pa.validationErrors.length > 0) {
      pushRow("Validation Issues", c2pa.validationErrors.join("; "));
    }
  } else {
    pushRow("C2PA Status", li.hasC2paBox ? "Detected container box" : "Not detected");
  }

  pushHeading("6. SynthID Verification");
  pushRow("Status", synthIdSummary.statusLabel);
  pushRow("Details", synthIdSummary.explanation);

  if (li.videoInfo.supported) {
    pushHeading("7. Video Container & Stream Info");
    pushRow("Container", li.videoInfo.container || "Unknown");
    pushRow("Video Codec", li.videoInfo.videoCodec || "Unknown");
    pushRow("Frame Rate", li.videoInfo.frameRate ? `${li.videoInfo.frameRate} fps` : "Unknown");
    pushRow(
      "Bitrate",
      li.videoInfo.bitrateKbps ? `${li.videoInfo.bitrateKbps} kbps` : "Unknown"
    );
    pushRow(
      "Audio Stream",
      li.videoInfo.audioCodec
        ? `${li.videoInfo.audioCodec}${li.videoInfo.audioChannels ? ` (${li.videoInfo.audioChannels}ch` : ""}${li.videoInfo.audioSampleRate ? `, ${li.videoInfo.audioSampleRate} Hz)` : ")"}`
        : "Not present or unknown"
    );
    pushRow("Scope Notice", li.videoInfo.containerOnlyNotice);
  }

  pushHeading("8. Privacy Metadata Summary");
  pushRow(
    "Personal Metadata",
    li.personalMetadata.hasPersonalMetadata
      ? `Detected (${li.personalMetadata.detectedFields.join(", ")})`
      : "Not detected"
  );
  if (privacyCleanSummary?.cleaned) {
    pushRow(
      "Privacy Clean Status",
      privacyCleanSummary.preservedOriginalBytes
        ? "Original bytes kept intact to preserve C2PA credentials"
        : `Removed: ${privacyCleanSummary.removedFields.join(", ") || "None present"}`
    );
    if (privacyCleanSummary.outputSha256) {
      pushRow("Output SHA-256", privacyCleanSummary.outputSha256);
    }
  } else {
    pushRow("Privacy Clean Status", "Not run (original file unchanged)");
  }

  // Paginate ~44 lines per page
  const pageChunks: Array<typeof lines> = [];
  const perPage = 44;
  for (let i = 0; i < lines.length; i += perPage) {
    pageChunks.push(lines.slice(i, i + perPage));
  }
  if (pageChunks.length === 0) pageChunks.push([]);

  // Object numbering:
  // 1: Catalog, 2: Pages, 3: Font F1 (Helvetica), 4: Font F2 (Helvetica-Bold)
  // Then each page i gets: Page obj (5 + 2*i), Content stream obj (6 + 2*i)
  const objects: string[] = [];
  const pageIds: number[] = [];

  for (let i = 0; i < pageChunks.length; i++) {
    pageIds.push(5 + i * 2);
  }

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  for (let i = 0; i < pageChunks.length; i++) {
    const pageId = 5 + i * 2;
    const contentId = pageId + 1;
    const streamCmds: string[] = ["BT", "/F1 10 Tf"];
    let y = 748;
    for (const ln of pageChunks[i]) {
      const font = ln.bold ? "/F2 11 Tf" : "/F1 10 Tf";
      streamCmds.push(font);
      streamCmds.push(`1 0 0 1 48 ${y} Tm (${sanitizePdfText(ln.text)}) Tj`);
      y -= ln.bold ? 16 : 14;
    }
    streamCmds.push("ET");
    const streamBody = streamCmds.join("\n");

    objects[pageId] =
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`;
    objects[contentId] =
      `${contentId} 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj\n`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += objects[id];
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const encoder = new TextEncoder();
  return encoder.encode(pdf);
}
