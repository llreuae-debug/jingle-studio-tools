import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { inspectBufferMetadata } from "../src/lib/browser-media-inspector";
import {
  buildInspectionReportJson,
  buildInspectionReportPdf,
  type ExportableInspectionReport,
} from "../src/lib/pdf-report";

describe("browser-media-inspector & pdf-report", () => {
  it("inspects a PNG with dimensions, sha256, and integrity status", async () => {
    const pngBuf = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 4,
        background: { r: 77, g: 46, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const report = await inspectBufferMetadata(
      new Uint8Array(pngBuf),
      "sample.png",
      "image/png"
    );

    expect(report.fileInfo.detectedFormat).toBe("PNG");
    expect(report.fileInfo.width).toBe(120);
    expect(report.fileInfo.height).toBe(80);
    expect(report.fileInfo.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.integrity.magicBytesValid).toBe(true);
    expect(report.integrity.extensionMatchesHeader).toBe(true);
    expect(report.integrity.structureValid).toBe(true);
    expect(report.videoInfo.supported).toBe(false);
    expect(report.videoInfo.status).toBe("Not detected");
  });

  it("inspects a JPEG with EXIF and GPS metadata", async () => {
    const jpgBuf = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 20, g: 160, b: 120 },
      },
    })
      .jpeg({ quality: 85 })
      .withMetadata({
        exif: {
          IFD0: {
            Make: "TestCam",
            Model: "Model-X",
            Software: "UnitTest-Studio",
          },
          IFD3: {
            GPSLatitudeRef: "N",
            GPSLatitude: "37/1 46/1 30/1",
            GPSLongitudeRef: "W",
            GPSLongitude: "122/1 25/1 10/1",
          },
        },
      })
      .toBuffer();

    const report = await inspectBufferMetadata(
      new Uint8Array(jpgBuf),
      "photo-with-gps.jpg",
      "image/jpeg"
    );

    expect(report.fileInfo.detectedFormat).toBe("JPEG");
    expect(report.exif.hasExif).toBe(true);
    expect(report.exif.make).toBe("TestCam");
    expect(report.exif.model).toBe("Model-X");
    expect(report.exif.hasGps).toBe(true);
    expect(report.exif.gps?.latitude).toBeCloseTo(37.775, 2);
    expect(report.exif.gps?.longitude).toBeCloseTo(-122.419, 2);
    expect(report.personalMetadata.hasPersonalMetadata).toBe(true);
    expect(report.personalMetadata.status).toBe("Detected");
  });

  it("flags invalid magic bytes and polyglot payloads", async () => {
    const fakePng = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const report = await inspectBufferMetadata(fakePng, "evil.png", "image/png");

    expect(report.integrity.magicBytesValid).toBe(false);
    expect(report.integrity.status).toBe("Inspection failed");
  });

  it("builds valid JSON and %PDF-1.4 inspection reports", async () => {
    const webpBuf = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .webp()
      .toBuffer();

    const localInspection = await inspectBufferMetadata(
      new Uint8Array(webpBuf),
      "check.webp",
      "image/webp"
    );

    const payload: ExportableInspectionReport = {
      generatedAt: "2026-11-20T00:00:00.000Z",
      localInspection,
      c2paInspection: null,
      synthIdSummary: {
        statusLabel: "SynthID verification unavailable",
        explanation: "Requires configured SynthID verification endpoint.",
      },
      privacyCleanSummary: null,
    };

    const jsonStr = buildInspectionReportJson(payload);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.localInspection.fileInfo.fileName).toBe("check.webp");

    const pdfBytes = buildInspectionReportPdf(payload);
    const pdfText = new TextDecoder("latin1").decode(pdfBytes);
    expect(pdfText.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfText.trim().endsWith("%%EOF")).toBe(true);
    expect(pdfText).toContain("check.webp");
    expect(pdfText).toContain("SynthID verification unavailable");
  });
});
