import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

// ============================================================================
// Programmatic Real Media Test Fixtures
// ============================================================================

function buildExifAndGpsTiff(): Buffer {
  // Big-endian TIFF with IFD0 (Make=Canon, Model=EOS R5, Artist=Jane Doe) + GPS IFD (37.7747, -122.4194)
  const out = Buffer.alloc(250);
  out.write("MM", 0, 2, "ascii");
  out.writeUInt16BE(42, 2);
  out.writeUInt32BE(8, 4);

  const strMake = Buffer.from("Canon\0", "ascii"); // 6
  const strModel = Buffer.from("EOS R5\0", "ascii"); // 7 -> 8
  const strArtist = Buffer.from("Jane Doe\0", "ascii"); // 9 -> 10

  // IFD0 at 8: 4 entries = 2 + 48 + 4 = 54 bytes -> ends at 62
  // String data at 62: 6 + 8 + 10 = 24 bytes -> ends at 86
  // GPS IFD at 86: 4 entries = 2 + 48 + 4 = 54 bytes -> ends at 140
  // GPS rationals at 140: 24 + 24 = 48 bytes -> ends at 188
  let pos = 8;
  out.writeUInt16BE(4, pos);
  pos += 2;

  const writeEntry = (tag: number, type: number, cnt: number, valOrOff: number, inlineStr?: string) => {
    out.writeUInt16BE(tag, pos);
    out.writeUInt16BE(type, pos + 2);
    out.writeUInt32BE(cnt, pos + 4);
    if (inlineStr) Buffer.from(inlineStr, "ascii").copy(out, pos + 8);
    else out.writeUInt32BE(valOrOff, pos + 8);
    pos += 12;
  };

  writeEntry(0x010f, 2, strMake.length, 62);
  writeEntry(0x0110, 2, strModel.length, 68);
  writeEntry(0x013b, 2, strArtist.length, 76);
  writeEntry(0x8825, 4, 1, 86);

  strMake.copy(out, 62);
  strModel.copy(out, 68);
  strArtist.copy(out, 76);

  pos = 86;
  out.writeUInt16BE(4, pos);
  pos += 2;
  writeEntry(0x0001, 2, 2, 0, "N\0");
  writeEntry(0x0002, 5, 3, 140);
  writeEntry(0x0003, 2, 2, 0, "W\0");
  writeEntry(0x0004, 5, 3, 164);

  // Latitude 37 deg 46 min 29 sec
  out.writeUInt32BE(37, 140);
  out.writeUInt32BE(1, 144);
  out.writeUInt32BE(46, 148);
  out.writeUInt32BE(1, 152);
  out.writeUInt32BE(29, 156);
  out.writeUInt32BE(1, 160);
  // Longitude 122 deg 25 min 10 sec
  out.writeUInt32BE(122, 164);
  out.writeUInt32BE(1, 168);
  out.writeUInt32BE(25, 172);
  out.writeUInt32BE(1, 176);
  out.writeUInt32BE(10, 180);
  out.writeUInt32BE(1, 184);

  return out;
}

function pngChunk(type: string, data: Buffer): Buffer {
  let c = 0xffffffff;
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  for (let i = 0; i < body.length; i++) {
    c ^= body[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  const crc = (c ^ 0xffffffff) >>> 0;
  const out = Buffer.allocUnsafe(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

async function createExifGpsPng(w = 64, h = 48): Promise<Buffer> {
  const base = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 80, g: 130, b: 220 } },
  })
    .png()
    .toBuffer();
  const tiff = buildExifAndGpsTiff();
  const exifChunk = pngChunk("eXIf", tiff);
  return Buffer.concat([base.subarray(0, 33), exifChunk, base.subarray(33)]);
}

async function createExifGpsJpeg(w = 64, h = 48): Promise<Buffer> {
  const base = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 220, g: 90, b: 140 } },
  })
    .jpeg()
    .toBuffer();
  const tiff = buildExifAndGpsTiff();
  const exifPayload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const hdr = Buffer.alloc(4);
  hdr[0] = 0xff;
  hdr[1] = 0xe1;
  hdr.writeUInt16BE(exifPayload.length + 2, 2);
  return Buffer.concat([base.subarray(0, 2), hdr, exifPayload, base.subarray(2)]);
}

async function createExifGpsWebp(w = 64, h = 48): Promise<Buffer> {
  const base = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 40, g: 190, b: 120 } },
  })
    .webp()
    .toBuffer();
  const tiff = buildExifAndGpsTiff();
  const body = base.subarray(12);
  const hdr = Buffer.alloc(8);
  hdr.write("EXIF", 0, 4, "ascii");
  hdr.writeUInt32LE(tiff.length, 4);
  const pad = tiff.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
  const fullBody = Buffer.concat([body, hdr, tiff, pad]);
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, 4, "ascii");
  riff.writeUInt32LE(4 + fullBody.length, 4);
  riff.write("WEBP", 8, 4, "ascii");
  return Buffer.concat([riff, fullBody]);
}

async function createCleanPng(w = 48, h = 48): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 24, g: 160, b: 96 } },
  })
    .png()
    .toBuffer();
}

async function createCorruptPng(): Promise<Buffer> {
  const valid = await createCleanPng(32, 32);
  // Keep valid 8-byte PNG signature + 25-byte IHDR, then corrupt IDAT stream
  return Buffer.concat([
    valid.subarray(0, 33),
    Buffer.from([0, 0, 0, 12, 0x49, 0x44, 0x41, 0x54, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 0, 0, 0]),
  ]);
}

async function createOversized16MbPng(): Promise<Buffer> {
  // compressionLevel: 0 produces an uncompressed ~16.2 MB valid PNG rapidly
  return sharp({
    create: { width: 2000, height: 2700, channels: 3, background: { r: 50, g: 75, b: 190 } },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ============================================================================
// Suite 1: Formats, Cleaning, Integrity, Dimensions, Downloads & Error Handling
// ============================================================================

test("Cases 1, 2, 3, 4, 8, 9, 11, 13, 15, 16, 17, 18, 19: PNG/JPG/JPEG/WEBP EXIF+GPS cleaning, integrity, dimensions & downloads", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const pngBuf = await createExifGpsPng(64, 48);
  const jpgBuf = await createExifGpsJpeg(64, 48);
  const webpBuf = await createExifGpsWebp(64, 48);

  const fixtures: Array<{
    name: string;
    mimeType: string;
    buf: Buffer;
    expectedFormat: string;
  }> = [
    { name: "photo.png", mimeType: "image/png", buf: pngBuf, expectedFormat: "png" },
    { name: "photo.jpg", mimeType: "image/jpeg", buf: jpgBuf, expectedFormat: "jpeg" },
    { name: "photo.jpeg", mimeType: "image/jpeg", buf: jpgBuf, expectedFormat: "jpeg" },
    { name: "photo.webp", mimeType: "image/webp", buf: webpBuf, expectedFormat: "webp" },
  ];

  await page.setViewportSize({ width: 1280, height: 800 });

  for (const fx of fixtures) {
    await page.goto("/tools", { waitUntil: "networkidle" });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: fx.name,
      mimeType: fx.mimeType,
      buffer: fx.buf,
    });

    await expect(page.getByRole("heading", { name: "Your Media Analysis" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();

    // Case 13: Default server has no external SynthID verifier -> MUST show "Your Image Is Ready" and grey "Verification Unavailable"
    await expect(page.getByRole("heading", { name: "Your Image Is Ready" })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator("body")).not.toContainText("Your Image Is SynthID-Free");
    await expect(page.getByText("Clean File Ready")).toBeVisible();
    await expect(page.getByText("Not Detected").first()).toBeVisible();
    await expect(page.getByText("Cleaned").first()).toBeVisible();
    await expect(page.getByText("Verification Unavailable").first()).toBeVisible();

    // Open Analysis Report & verify dimension preservation + 10 stages
    await page.getByRole("button", { name: "View Analysis Report" }).click();
    await expect(page.getByText("Dimensions Preserved")).toBeVisible();
    await expect(page.getByText("Backend Stage Log (10 steps)")).toBeVisible();
    await expect(page.getByText("1. File uploaded")).toBeVisible();
    await expect(page.getByText("9. Output integrity verified")).toBeVisible();
    await expect(page.getByText("10. Download prepared")).toBeVisible();

    // Case 18 & 19: Download both processed and original via real link URLs & verify pixel integrity + dimensions
    const processedHref = await page
      .getByRole("link", { name: "Download Processed Image" })
      .getAttribute("href");
    const originalHref = await page
      .getByRole("link", { name: "Download Original Image" })
      .getAttribute("href");
    expect(processedHref).toContain("/api/privacy-clean/download?token=");
    expect(originalHref).toContain("/api/privacy-clean/download?token=");

    // Download via browser context (sends privacy_session cookie)
    const cleanB64 = await page.evaluate(async (href) => {
      const r = await fetch(href!);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ab = await r.arrayBuffer();
      let bin = "";
      for (const b of new Uint8Array(ab)) bin += String.fromCharCode(b);
      return btoa(bin);
    }, processedHref);
    const cleanedBytes = Buffer.from(cleanB64, "base64");
    expect(cleanedBytes.length).toBeGreaterThan(0);

    // Case 16 & 17: Verify pixel integrity and exact 64x48 dimension preservation with sharp
    const decodedMeta = await sharp(cleanedBytes, { failOn: "error" }).metadata();
    await sharp(cleanedBytes, { failOn: "error" }).stats();
    expect(decodedMeta.format).toBe(fx.expectedFormat);
    expect(decodedMeta.width).toBe(64);
    expect(decodedMeta.height).toBe(48);
    // Personal EXIF must have been stripped
    expect(decodedMeta.exif).toBeUndefined();

    // Case 18: Original file download matches input SHA-256 byte-for-byte
    const origB64 = await page.evaluate(async (href) => {
      const r = await fetch(href!);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ab = await r.arrayBuffer();
      let bin = "";
      for (const b of new Uint8Array(ab)) bin += String.fromCharCode(b);
      return btoa(bin);
    }, originalHref);
    const downloadedOriginal = Buffer.from(origB64, "base64");
    expect(sha256Hex(downloadedOriginal)).toBe(sha256Hex(fx.buf));

    // Verify expired/tampered download token returns 403 ERR_LINK_EXPIRED
    const expiredRes = await request.get(`${processedHref}invalid`);
    expect(expiredRes.status()).toBe(403);
    const expiredJson = await expiredRes.json();
    expect(expiredJson.code).toBe("ERR_LINK_EXPIRED");

    // Process Another Image resets UI cleanly
    await page.getByRole("button", { name: "Process Another Image" }).click();
    await expect(page.getByText("Browse Files")).toBeVisible();
  }

  expect(errors).toEqual([]);
});

// ============================================================================
// Suite 2: Invalid, Corrupted, Oversized, Failure/Retry, Cancel & Expired UI Refresh
// ============================================================================

test("Cases 5, 6, 7, 14, 19 (UI refresh): Rejects invalid/corrupted/oversized images, handles 500 failure + retry + cancel + expired download refresh", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tools", { waitUntil: "networkidle" });

  // Case 5: Invalid disguised file
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "not-an-image.png",
    mimeType: "image/png",
    buffer: Buffer.from("<html>malicious</html>", "utf8"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /valid PNG, JPG/i })
  ).toBeVisible();

  // Case 6: Corrupted PNG (valid header, invalid compressed IDAT stream) rejected in UI AND API 400
  const corruptPng = await createCorruptPng();
  await fileInput.setInputFiles({
    name: "corrupt.png",
    mimeType: "image/png",
    buffer: corruptPng,
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /corrupted|truncated|decoded/i })
  ).toBeVisible({ timeout: 10000 });

  const apiCorrupt = await page.request.post("/api/privacy-clean", {
    multipart: {
      file: {
        name: "corrupt.png",
        mimeType: "image/png",
        buffer: corruptPng,
      },
    },
  });
  expect(apiCorrupt.status()).toBe(400);
  expect((await apiCorrupt.json()).code).toBe("ERR_CORRUPTED_IMAGE");

  // Case 7: Oversized (>15 MB guest limit) rejected in UI AND API 413
  const bigPng = await createOversized16MbPng();
  expect(bigPng.length).toBeGreaterThan(15 * 1024 * 1024);
  await fileInput.setInputFiles({
    name: "huge-guest.png",
    mimeType: "image/png",
    buffer: bigPng,
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /15 MB/i })
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("link", { name: /Create free account/i })
  ).toBeVisible();

  const apiOversized = await page.request.post("/api/privacy-clean/upload-init", {
    data: {
      fileName: "huge-guest.png",
      mimeType: "image/png",
      fileSizeBytes: bigPng.length,
    },
  });
  expect(apiOversized.status()).toBe(413);
  expect((await apiOversized.json()).code).toBe("ERR_FILE_TOO_LARGE");

  // Case 14: Server processing failure (HTTP 500) -> Error UI + Retry recovery
  const cleanPng = await createCleanPng(40, 40);
  await fileInput.setInputFiles({
    name: "already-clean.png",
    mimeType: "image/png",
    buffer: cleanPng,
  });
  await expect(page.getByRole("heading", { name: "Your Media Analysis" })).toBeVisible({
    timeout: 15000,
  });

  // Fail once on POST /api/privacy-clean
  await page.route("**/api/privacy-clean", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated storage outage", code: "ERR_STORAGE" }),
      });
    }
    return route.continue();
  });

  await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Simulated storage outage" })
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Clean File Ready")).toHaveCount(0);

  // Unroute and test Retry recovery
  await page.unroute("**/api/privacy-clean");

  // Also test Cancel during an in-flight delayed processing request before succeeding via Retry
  const delayCtrl: { release?: () => void } = {};
  await page.route("**/api/privacy-clean", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise<void>((res) => {
        delayCtrl.release = res;
        setTimeout(res, 4000);
      });
      await route.abort().catch(() => {});
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Retry" }).click();
  const cancelBtn = page.getByRole("button", { name: "Cancel" });
  await expect(cancelBtn).toBeVisible({ timeout: 5000 });
  await cancelBtn.click();
  delayCtrl.release?.();
  await page.unroute("**/api/privacy-clean");

  await expect(page.getByRole("status")).toContainText(/Processing was cancelled/i, {
    timeout: 10000,
  });
  await expect(page.getByText("Clean File Ready")).toHaveCount(0);

  // Now complete via real server request
  await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
  await expect(page.getByRole("heading", { name: "Your Image Is Ready" })).toBeVisible({
    timeout: 20000,
  });
  // Clean image has no personal EXIF -> shows "Already Clean"
  await expect(page.getByText("Already Clean").first()).toBeVisible();

  // Case 19 (UI recovery for expired download link): intercept download with 403 once, verify Refresh Download Link restores download
  await page.route("**/api/privacy-clean/download*", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Download link has expired or is invalid. Please refresh the download link.",
        code: "ERR_LINK_EXPIRED",
      }),
    })
  );

  await page.getByRole("link", { name: "Download Processed Image" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /expired/i })
  ).toBeVisible({ timeout: 10000 });
  const refreshBtn = page.getByRole("button", { name: "Refresh Download Link" });
  await expect(refreshBtn).toBeVisible();

  await page.unroute("**/api/privacy-clean/download*");
  await refreshBtn.click();
  await expect(refreshBtn).toBeHidden({ timeout: 10000 });

  // Verify actual browser download event after link refresh
  const dlPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Processed Image" }).click();
  const download = await dlPromise;
  expect(download.suggestedFilename()).toBe("already-clean-privacy-cleaned.png");
});

// ============================================================================
// Suite 3: C2PA Preserved vs Not Detected, Registered User, History & Mobile
// ============================================================================

test("Cases 10, 20, 21, 22, 23: C2PA preserved intact, Registered 25 MB limit, History detail /app/media/[id], Download audit & Mobile overflow", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // Sign up a real user account
  const email = `synthid-reg-${Date.now()}@example.com`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill("Registered Media User");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password (min 6 characters)").fill("StrongPass123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created and signed in!")).toBeVisible({
    timeout: 15000,
  });

  // Case 10: Produce a real C2PA-signed PNG using the in-app signer first
  await page.goto("/app/sign", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').first().setInputFiles("public/favicon-96x96.png");
  await page.locator('input[type="text"][required]').first().fill("Real Studio");
  await page.getByRole("button", { name: /Sign files/i }).click();
  await page.waitForURL(/\/app\/jobs\/.+/, { timeout: 15000 });
  await expect(page.locator("body")).toContainText("1 / 1 signed", { timeout: 20000 });

  const signedHref = await page
    .locator('a[href*="/api/files/download"]')
    .first()
    .getAttribute("href");
  expect(signedHref).toBeTruthy();

  const signedB64 = await page.evaluate(async (href) => {
    const r = await fetch(href!);
    const ab = await r.arrayBuffer();
    let bin = "";
    for (const b of new Uint8Array(ab)) bin += String.fromCharCode(b);
    return btoa(bin);
  }, signedHref);
  const signedBuf = Buffer.from(signedB64, "base64");
  const signedInputHash = sha256Hex(signedBuf);

  // Inspect & clean the C2PA-signed PNG on /tools (test on mobile 375x812!)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools", { waitUntil: "networkidle" });
  await expect(page.getByText(/Free: up to 25 MB images/i)).toBeVisible({ timeout: 10000 });

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "signed-work.png",
    mimeType: "image/png",
    buffer: signedBuf,
  });

  await expect(page.getByText("A. C2PA Content Credentials")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();

  await expect(page.getByRole("heading", { name: "Your Image Is Ready" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("Preserved").first()).toBeVisible();
  await expect(page.getByText("Not Processed").first()).toBeVisible();

  await page.getByRole("button", { name: "View Analysis Report" }).click();
  await expect(page.getByText(`Output SHA-256: ${signedInputHash}`)).toBeVisible();

  // Case 23: Mobile 375px zero horizontal overflow on completion screen + expanded report
  const toolsOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(toolsOverflow).toBe(false);

  // Trigger a download so media_download_records logs it
  const dlPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Processed Image" }).click();
  await dlPromise;

  // Case 21: Verify 16 MB PNG (rejected for guests) is accepted for registered user (25 MB limit)
  const bigPng = await createOversized16MbPng();
  await page.getByRole("button", { name: "Process Another Image" }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "registered-16mb.png",
    mimeType: "image/png",
    buffer: bigPng,
  });
  // Chunked upload + clean through 25 MB limit
  await expect(page.getByRole("heading", { name: "Your Media Analysis" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
  await expect(page.getByRole("heading", { name: "Your Image Is Ready" })).toBeVisible({
    timeout: 30000,
  });

  // Case 22 & 23: Navigate to Dashboard history & saved report detail /app/media/[id]
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("signed-work.png")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("registered-16mb.png")).toBeVisible();

  await page
    .locator("tr", { hasText: "signed-work.png" })
    .getByRole("link", { name: "View Report" })
    .click();
  await page.waitForURL(/\/app\/media\/.+/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "signed-work.png" })).toBeVisible();
  await expect(page.getByText("Download Activity (1)")).toBeVisible();
  await expect(page.getByText("Before & After Metadata Comparison")).toBeVisible();

  const detailOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(detailOverflow).toBe(false);

  expect(errors).toEqual([]);
});

// ============================================================================
// Suite 4: Case 12 — Pluggable Real SynthID Verifier Available (Port 3005)
// ============================================================================

test("Case 12: Genuine SynthID verifier displays Your Image Is SynthID-Free on verified_no_signal, red Signal Detected on positive, and honest fallback on failure", async ({
  page,
}) => {
  test.setTimeout(90_000);

  let mode: "no_detectable_signal" | "signal_detected" | "error_503" = "no_detectable_signal";
  const tmpDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "synthid-e2e-"));

  const verifierServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (mode === "error_503") {
        res.statusCode = 503;
        res.end("Detector busy");
        return;
      }
      res.setHeader("Content-Type", "application/json");
      if (mode === "signal_detected") {
        res.end(
          JSON.stringify({
            verdict: "signal_detected",
            confidence: 0.94,
            provider: "Google SynthID Test Detector",
          })
        );
        return;
      }
      res.end(
        JSON.stringify({
          verdict: "no_detectable_signal",
          confidence: 0.98,
          provider: "Google SynthID Test Detector",
        })
      );
    });
  });

  await new Promise<void>((resolve) => verifierServer.listen(0, "127.0.0.1", resolve));
  const vAddr = verifierServer.address() as { port: number };
  const verifierUrl = `http://127.0.0.1:${vAddr.port}/verify`;

  const nextProc = spawn(
    "./node_modules/.bin/next",
    ["start", "-H", "127.0.0.1", "-p", "3005"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_SECRET: "playwright-synthid-port3005-secret-32b",
        DATABASE_URL: "pglite://:memory:",
        LOCAL_STORAGE_DIR: path.join(tmpDataDir, ".storage"),
        SYNTHID_VERIFIER_URL: verifierUrl,
        SYNTHID_VERIFIER_PROVIDER: "Google SynthID Test Detector",
      },
      stdio: "pipe",
    }
  );

  try {
    // Poll /api/health until port 3005 is ready
    const deadline = Date.now() + 25_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const h = await fetch("http://127.0.0.1:3005/api/health");
        if (h.ok) {
          const j = (await h.json()) as { synthIdVerifierConfigured?: boolean };
          if (j.synthIdVerifierConfigured) {
            ready = true;
            break;
          }
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(ready).toBe(true);

    const png = await createExifGpsPng(48, 48);

    // 1. Verifier returns no_detectable_signal -> "Your Image Is SynthID-Free" + caveat
    mode = "no_detectable_signal";
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://127.0.0.1:3005/tools", { waitUntil: "networkidle" });
    await expect(page.getByText("Browse Files")).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "verified-free.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByText("Verifier available on clean")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
    await expect(
      page.getByRole("heading", { name: "Your Image Is SynthID-Free" })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Verified No Detectable SynthID Signal")).toBeVisible();
    await expect(
      page.getByText(/Absence of a detected signal does not prove that SynthID is absent/i)
    ).toBeVisible();

    // 2. Verifier returns signal_detected -> "Your Image Is Ready" + red "Signal Detected"
    mode = "signal_detected";
    await page.getByRole("button", { name: "Process Another Image" }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "has-synthid.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
    await expect(
      page.getByRole("heading", { name: "Your Image Is Ready" })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator("body")).not.toContainText("Your Image Is SynthID-Free");
    await expect(page.getByText("Signal Detected").first()).toBeVisible();

    // 3. Verifier returns HTTP 503 -> honest "Verification Unavailable", never green
    mode = "error_503";
    await page.getByRole("button", { name: "Process Another Image" }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "detector-down.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
    await expect(
      page.getByRole("heading", { name: "Your Image Is Ready" })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Verification Unavailable").first()).toBeVisible();
  } finally {
    nextProc.kill("SIGTERM");
    await new Promise<void>((resolve) => verifierServer.close(() => resolve()));
    await fs.rm(tmpDataDir, { recursive: true, force: true });
  }
});
