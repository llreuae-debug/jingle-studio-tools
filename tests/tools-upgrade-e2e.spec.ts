import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import sharp from "sharp";

function buildMinimalMp4Buffer(): Buffer {
  // Valid ISO BMFF MP4 with ftyp + moov (mvhd + video trak with avc1 + audio trak with mp4a)
  const box = (type: string, body: Buffer) => {
    const out = Buffer.alloc(8 + body.length);
    out.writeUInt32BE(8 + body.length, 0);
    out.write(type, 4, 4, "ascii");
    body.copy(out, 8);
    return out;
  };
  const fullBox = (type: string, version: number, flags: number, body: Buffer) => {
    const hdr = Buffer.alloc(4 + body.length);
    hdr[0] = version;
    hdr[1] = (flags >> 16) & 0xff;
    hdr[2] = (flags >> 8) & 0xff;
    hdr[3] = flags & 0xff;
    body.copy(hdr, 4);
    return box(type, hdr);
  };

  const ftyp = box("ftyp", Buffer.from("isom\x00\x00\x02\x00isommp41", "latin1"));

  const mvhdBody = Buffer.alloc(96);
  mvhdBody.writeUInt32BE(1000, 8); // timescale
  mvhdBody.writeUInt32BE(5000, 12); // duration = 5.0s
  const mvhd = fullBox("mvhd", 0, 0, mvhdBody);

  // Video track
  const tkhdVBody = Buffer.alloc(80);
  tkhdVBody.writeUInt32BE(1280 << 16, 72);
  tkhdVBody.writeUInt32BE(720 << 16, 76);
  const tkhdV = fullBox("tkhd", 0, 1, tkhdVBody);

  const mdhdBody = Buffer.alloc(20);
  mdhdBody.writeUInt32BE(30000, 8);
  mdhdBody.writeUInt32BE(150000, 12);
  const mdhdV = fullBox("mdhd", 0, 0, mdhdBody);
  const hdlrVBody = Buffer.alloc(20);
  hdlrVBody.write("vide", 4, 4, "ascii");
  const hdlrV = fullBox("hdlr", 0, 0, hdlrVBody);

  const avc1Body = Buffer.alloc(78);
  avc1Body.writeUInt16BE(1280, 24);
  avc1Body.writeUInt16BE(720, 26);
  const avc1 = box("avc1", avc1Body);
  const stsdVHeader = Buffer.alloc(4 + avc1.length);
  stsdVHeader.writeUInt32BE(1, 0);
  avc1.copy(stsdVHeader, 4);
  const stsdV = fullBox("stsd", 0, 0, stsdVHeader);
  const stblV = box("stbl", stsdV);
  const minfV = box("minf", stblV);
  const mdiaV = box("mdia", Buffer.concat([mdhdV, hdlrV, minfV]));
  const trakV = box("trak", Buffer.concat([tkhdV, mdiaV]));

  // Audio track
  const tkhdABody = Buffer.alloc(80);
  const tkhdA = fullBox("tkhd", 0, 1, tkhdABody);
  const mdhdA = fullBox("mdhd", 0, 0, mdhdBody);
  const hdlrABody = Buffer.alloc(20);
  hdlrABody.write("soun", 4, 4, "ascii");
  const hdlrA = fullBox("hdlr", 0, 0, hdlrABody);
  const mp4aBody = Buffer.alloc(28);
  mp4aBody.writeUInt16BE(2, 16); // channels
  mp4aBody.writeUInt16BE(16, 18); // sample size
  mp4aBody.writeUInt32BE((48000 * 65536) >>> 0, 24); // sampleRate
  const mp4a = box("mp4a", mp4aBody);
  const stsdAHeader = Buffer.alloc(4 + mp4a.length);
  stsdAHeader.writeUInt32BE(1, 0);
  mp4a.copy(stsdAHeader, 4);
  const stsdA = fullBox("stsd", 0, 0, stsdAHeader);
  const stblA = box("stbl", stsdA);
  const minfA = box("minf", stblA);
  const mdiaA = box("mdia", Buffer.concat([mdhdA, hdlrA, minfA]));
  const trakA = box("trak", Buffer.concat([tkhdA, mdiaA]));

  const moov = box("moov", Buffer.concat([mvhd, trakV, trakA]));
  const mdat = box("mdat", Buffer.alloc(64_000));
  return Buffer.concat([ftyp, moov, mdat]);
}

async function createSamplePng(width = 160, height = 120): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 77, g: 46, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function createSampleJpegWithGps(): Promise<Buffer> {
  return sharp({
    create: { width: 120, height: 90, channels: 3, background: { r: 30, g: 130, b: 220 } },
  })
    .jpeg({ quality: 90 })
    .withMetadata({
      exif: {
        IFD0: {
          Make: "JingleTestCam",
          Model: "JT-900",
          Software: "TestCameraApp 2.0",
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
}

async function createSampleWebp(): Promise<Buffer> {
  return sharp({
    create: { width: 140, height: 100, channels: 3, background: { r: 220, g: 90, b: 40 } },
  })
    .webp({ quality: 85 })
    .toBuffer();
}

test.describe("JingleStudio Tools Reconstruction & 20-Scenario Verification", () => {
  test("Cases 1–3 & 9–11: PNG, JPG (EXIF+GPS), WebP, Video MP4 inspection, 8-Category Report, C2PA & SynthID unavailable", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tools", { waitUntil: "networkidle" });

    // Hero verification
    await expect(
      page.getByRole("heading", { name: "Know What's Inside Your Media." })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Inspect Your File" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Tools" })).toBeVisible();

    // Case 1: Valid PNG
    const pngBuf = await createSamplePng();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "valid-sample.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });

    const reportSection = page.getByRole("region", { name: "8-Category Inspection Report" });
    await expect(reportSection).toBeVisible({ timeout: 15000 });
    await expect(reportSection.getByText("1. Media file information")).toBeVisible();
    await expect(reportSection.getByText("2. EXIF metadata")).toBeVisible();
    await expect(reportSection.getByText("3. IPTC & XMP metadata")).toBeVisible();
    await expect(
      reportSection.getByText("4. C2PA Content Credentials verification")
    ).toBeVisible();
    await expect(reportSection.getByText("5. Embedded provenance information")).toBeVisible();
    await expect(reportSection.getByText("6. Available SynthID verification status")).toBeVisible();
    await expect(reportSection.getByText("SynthID verification unavailable")).toBeVisible();
    await expect(reportSection.getByText("7. Video container & frame information")).toBeVisible();
    await expect(reportSection.getByText("8. File integrity & format validation")).toBeVisible();

    // Case 2: Valid JPEG with EXIF + GPS + toggle
    const jpgBuf = await createSampleJpegWithGps();
    await fileInput.setInputFiles({
      name: "exif-gps.jpg",
      mimeType: "image/jpeg",
      buffer: jpgBuf,
    });
    await expect(reportSection.getByText("JingleTestCam JT-900")).toBeVisible({ timeout: 15000 });
    await reportSection.getByRole("button", { name: "Show GPS coordinates" }).click();
    await expect(reportSection.getByText(/37\.77/)).toBeVisible();

    // Case 3: Valid WebP
    const webpBuf = await createSampleWebp();
    await fileInput.setInputFiles({
      name: "sample.webp",
      mimeType: "image/webp",
      buffer: webpBuf,
    });
    await expect(reportSection.getByText(/WEBP \(image\/webp\)/i)).toBeVisible({ timeout: 15000 });

    // Case 9b: Video MP4 container & audio stream inspection
    const mp4Buf = buildMinimalMp4Buffer();
    await fileInput.setInputFiles({
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: mp4Buf,
    });
    await expect(reportSection.getByText(/MP4.*avc1/i)).toBeVisible({ timeout: 15000 });
    await expect(reportSection.getByText(/mp4a/i)).toBeVisible();
    await expect(
      reportSection.getByText(/inspects container headers, streams, and metadata only/i)
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("Cases 4–8: Unsupported, empty 0B, corrupted, oversized >15MB, and multi-file queue", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/tools", { waitUntil: "networkidle" });
    const fileInput = page.locator('input[type="file"]').first();

    // Case 4: Unsupported file type
    await fileInput.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello world"),
    });
    await expect(page.getByRole("alert").filter({ hasText: /Unsupported file/i })).toBeVisible();

    // Case 5: Empty 0-byte file
    await fileInput.setInputFiles({
      name: "empty.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(0),
    });
    await expect(page.getByRole("alert").filter({ hasText: /empty/i })).toBeVisible();

    // Case 6: Corrupted PNG
    await fileInput.setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: /corrupted|unreadable|decoded/i })
    ).toBeVisible({
      timeout: 15000,
    });

    // Case 7: Oversized guest image (>15 MB)
    const bigPng = Buffer.alloc(16 * 1024 * 1024);
    bigPng[0] = 0x89;
    bigPng[1] = 0x50;
    bigPng[2] = 0x4e;
    bigPng[3] = 0x47;
    await fileInput.setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: bigPng,
    });
    await expect(page.getByRole("alert").filter({ hasText: /15 MB/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create free account/i })).toBeVisible();

    // Case 8: Multi-file queue upload, switch, remove item, Clear All Files
    const png1 = await createSamplePng(100, 100);
    const png2 = await createSamplePng(200, 150);
    await fileInput.setInputFiles([
      { name: "first-queue.png", mimeType: "image/png", buffer: png1 },
      { name: "second-queue.png", mimeType: "image/png", buffer: png2 },
    ]);
    const queueBar = page.getByLabel("Selected files queue");
    await expect(queueBar).toBeVisible({ timeout: 15000 });
    await expect(queueBar.getByText("Inspection Queue (2 files)")).toBeVisible();
    await queueBar.getByRole("button", { name: "second-queue.png", exact: true }).click();
    await expect(page.getByText("200 × 150 px")).toBeVisible({ timeout: 15000 });
    await queueBar.getByRole("button", { name: "Remove first-queue.png from queue" }).click();
    await expect(queueBar.getByText("Inspection Queue (1 file)")).toBeVisible();
    await queueBar.getByRole("button", { name: "Clear All Files" }).click();
    await expect(queueBar).toBeHidden();
  });

  test("Cases 12–13: Native <dialog> privacy cleaning confirmation, cancel vs confirm, original SHA-256 preserved & JSON/PDF report downloads", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/tools", { waitUntil: "networkidle" });

    const jpgBuf = await createSampleJpegWithGps();
    const expectedOrigSha = crypto.createHash("sha256").update(jpgBuf).digest("hex");

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "gps-clean-test.jpg",
      mimeType: "image/jpeg",
      buffer: jpgBuf,
    });

    await expect(page.getByRole("region", { name: "8-Category Inspection Report" })).toBeVisible({
      timeout: 15000,
    });

    // Download Original File directly & verify SHA-256 unchanged
    const [origDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Original File" }).click(),
    ]);
    const origPath = await origDl.path();
    const origBytes = await fs.readFile(origPath!);
    expect(crypto.createHash("sha256").update(origBytes).digest("hex")).toBe(expectedOrigSha);

    // Download JSON report & verify valid JSON
    const [jsonDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download JSON Report" }).click(),
    ]);
    const jsonPath = await jsonDl.path();
    const parsedJson = JSON.parse(await fs.readFile(jsonPath!, "utf8"));
    expect(parsedJson.localInspection.fileInfo.fileName).toBe("gps-clean-test.jpg");
    expect(parsedJson.localInspection.exif.hasGps).toBe(true);

    // Download PDF report & verify %PDF-1.4 header
    const [pdfDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download PDF Report" }).click(),
    ]);
    const pdfPath = await pdfDl.path();
    const pdfBytes = await fs.readFile(pdfPath!);
    expect(pdfBytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdfBytes.length).toBeGreaterThan(500);

    // Cancel native <dialog> -> file remains uncleaned
    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
    await expect(page.getByRole("heading", { name: "Confirm Privacy Metadata Cleaning" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Clean File Ready")).toBeHidden();

    // Confirm in native <dialog> -> server cleans EXIF/GPS & produces clean copy
    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
    await page.getByRole("button", { name: /Confirm & Clean Copy/i }).click();
    await expect(page.getByText("Clean File Ready")).toBeVisible({ timeout: 25000 });
  });

  test("Cases 14–15: Dedicated Image Converter, Resizer, Compressor & Integrity Checker real outputs", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const pngBuf = await createSamplePng(400, 300);

    // 1. Image Format Converter: PNG -> WebP
    await page.goto("/tools/image-converter", { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "convert-me.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });
    const convertBtn = page.getByRole("button", { name: "Download Converted Image" });
    await expect(convertBtn).toBeVisible({ timeout: 15000 });
    const [convDl] = await Promise.all([page.waitForEvent("download"), convertBtn.click()]);
    const convBytes = await fs.readFile((await convDl.path())!);
    const convMeta = await sharp(convBytes).metadata();
    expect(convMeta.format).toBe("webp");
    expect(convMeta.width).toBe(400);
    expect(convMeta.height).toBe(300);

    // 2. Image Resizer: 400x300 -> 320x240
    await page.goto("/tools/image-resizer", { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "resize-me.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });
    await expect(page.getByRole("button", { name: "Download Resized Image" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "320×240" }).click();
    await expect(page.getByText("320 × 240 px (from 400 × 300)")).toBeVisible({ timeout: 15000 });
    const [resDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Resized Image" }).click(),
    ]);
    const resBytes = await fs.readFile((await resDl.path())!);
    const resMeta = await sharp(resBytes).metadata();
    expect(resMeta.width).toBe(320);
    expect(resMeta.height).toBe(240);

    // 3. Image Compressor: PNG -> JPEG compressed
    await page.goto("/tools/image-compressor", { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "compress-me.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });
    const compBtn = page.getByRole("button", { name: "Download Compressed Image" });
    await expect(compBtn).toBeVisible({ timeout: 15000 });
    const [compDl] = await Promise.all([page.waitForEvent("download"), compBtn.click()]);
    const compBytes = await fs.readFile((await compDl.path())!);
    const compMeta = await sharp(compBytes).metadata();
    expect(compMeta.format).toBe("jpeg");

    // 4. File Integrity Checker + SHA-256 comparison
    const expectedSha = crypto.createHash("sha256").update(pngBuf).digest("hex");
    await page.goto("/tools/file-integrity-checker", { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify-me.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });
    await expect(page.getByText(expectedSha)).toBeVisible({ timeout: 15000 });
    await page.getByLabel(/Compare against Expected SHA-256/i).fill(expectedSha);
    await expect(page.getByText(/Checksum Match Verified/i)).toBeVisible();
  });

  test("Cases 16–20: Mobile & desktop responsiveness across all 10 tool routes, refresh reset, and failure recovery", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    const server500s: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (res) => {
      if (res.status() >= 500) server500s.push(`${res.status()} ${res.url()}`);
    });

    const toolRoutes = [
      "/tools",
      "/tools/media-metadata-inspector",
      "/tools/exif-viewer",
      "/tools/content-credentials-check",
      "/tools/file-integrity-checker",
      "/tools/image-converter",
      "/tools/image-resizer",
      "/tools/image-compressor",
      "/tools/video-metadata-inspector",
      "/tools/privacy-metadata-cleaner",
      "/tools/report-generator",
    ];

    // Mobile 375x812 check
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of toolRoutes) {
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, `Mobile horizontal overflow on ${route}`).toBe(false);
    }

    // Browser refresh state reset check
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tools", { waitUntil: "networkidle" });
    const pngBuf = await createSamplePng();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "refresh-reset.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });
    await expect(page.getByLabel("Selected files queue")).toBeVisible({ timeout: 15000 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel("Selected files queue")).toBeHidden();

    // Failed processing recovery: intercept /api/privacy-clean with 500 once, then verify Retry works
    let failOnce = true;
    await page.route("**/api/privacy-clean", async (route) => {
      if (failOnce && route.request().method() === "POST") {
        failOnce = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated server error for recovery test." }),
        });
        return;
      }
      await route.continue();
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "retry-test.png",
      mimeType: "image/png",
      buffer: pngBuf,
    });
    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
    await page.getByRole("button", { name: /Confirm & Clean Copy/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Simulated server error/i })
    ).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("Clean File Ready")).toBeVisible({ timeout: 25000 });

    expect(errors).toEqual([]);
    // Only the deliberately simulated 500 should ever appear
    expect(server500s.filter((s) => !s.includes("/api/privacy-clean"))).toEqual([]);
  });
});
