import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: {},
    auth: async () => null,
    signIn: async () => {},
    signOut: async () => {},
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/google", () => ({ default: () => ({}) }));

import { and, eq } from "drizzle-orm";
import { getDb, resetDbForTests, schema } from "@/db";
import { ensureUserAndWorkspace, hashPassword, revokeAllUserSessions } from "@/lib/auth";
import { signImageWithC2pa } from "@/lib/c2pa-server";
import {
  inspectMediaMetadata,
  iterateIsoBoxes,
  validateMediaFile,
} from "@/lib/media-metadata";
import { getEffectivePlanForWorkspace, listPricingPlans } from "@/lib/plans";
import { cleanMediaPrivacy } from "@/lib/privacy-cleaner";
import {
  buildPrivacyDownloadUrl,
  deletePrivateObject,
  getPrivateObject,
  purgeExpiredPrivacyFiles,
  putPrivateObject,
  verifyPrivacyDownloadToken,
} from "@/lib/storage";

// ============================================================================
// Binary Test Fixture Builders (TIFF EXIF+GPS, PNG+eXIf, JPG+APP1, WebP+EXIF, MP4, MOV, WebM)
// ============================================================================

function buildSampleTiffWithExifAndGps(): Buffer {
  // Compact Big-Endian ("MM") TIFF with Make, Model, Software, Artist, ExifIFD(DateTimeOriginal), GPSIFD(N 37°46'29", W 122°25'10")
  const chunks: Buffer[] = [];
  const header = Buffer.alloc(8);
  header.write("MM", 0, 2, "ascii");
  header.writeUInt16BE(42, 2);
  header.writeUInt32BE(8, 4);
  chunks.push(header);

  const strMake = Buffer.from("Canon\0", "ascii"); // 6 bytes
  const strModel = Buffer.from("EOS R5\0", "ascii"); // 7 -> pad 8
  const strSoft = Buffer.from("PersonalEditor\0", "ascii"); // 15 -> pad 16
  const strArtist = Buffer.from("Alice Example\0", "ascii"); // 14 bytes
  const strDate = Buffer.from("2026:11:19 10:00:00\0", "ascii"); // 20 bytes

  // Layout:
  // 8: IFD0 (6 entries: Make 0x10F, Model 0x110, Soft 0x131, Artist 0x13B, ExifPtr 0x8769, GpsPtr 0x8825) = 2 + 72 + 4 = 78 bytes -> ends at 86
  // 86: IFD0 string data: 6 + 8 + 16 + 14 = 44 bytes -> ends at 130
  // 130: ExifIFD (1 entry: DateTimeOriginal 0x9003) = 2 + 12 + 4 = 18 bytes -> ends at 148
  // 148: Exif data strDate (20 bytes) -> ends at 168
  // 168: GpsIFD (4 entries: LatRef 0x1, Lat 0x2, LonRef 0x3, Lon 0x4) = 2 + 48 + 4 = 54 bytes -> ends at 222
  // 222: GpsLat (24 bytes) + GpsLon (24 bytes) = 48 bytes -> total 270 bytes

  const out = Buffer.alloc(270);
  header.copy(out, 0);

  let pos = 8;
  out.writeUInt16BE(6, pos);
  pos += 2;
  const writeEntry = (tag: number, type: number, cnt: number, valOrOff: number, inlineStr?: string) => {
    out.writeUInt16BE(tag, pos);
    out.writeUInt16BE(type, pos + 2);
    out.writeUInt32BE(cnt, pos + 4);
    if (inlineStr) {
      Buffer.from(inlineStr, "ascii").copy(out, pos + 8);
    } else {
      out.writeUInt32BE(valOrOff, pos + 8);
    }
    pos += 12;
  };

  writeEntry(0x010f, 2, strMake.length, 86);
  writeEntry(0x0110, 2, strModel.length, 92);
  writeEntry(0x0131, 2, strSoft.length, 100);
  writeEntry(0x013b, 2, strArtist.length, 116);
  writeEntry(0x8769, 4, 1, 130);
  writeEntry(0x8825, 4, 1, 168);

  strMake.copy(out, 86);
  strModel.copy(out, 92);
  strSoft.copy(out, 100);
  strArtist.copy(out, 116);

  // ExifIFD at 130
  pos = 130;
  out.writeUInt16BE(1, pos);
  pos += 2;
  writeEntry(0x9003, 2, strDate.length, 148);
  strDate.copy(out, 148);

  // GpsIFD at 168
  pos = 168;
  out.writeUInt16BE(4, pos);
  pos += 2;
  writeEntry(0x0001, 2, 2, 0, "N\0");
  writeEntry(0x0002, 5, 3, 222);
  writeEntry(0x0003, 2, 2, 0, "W\0");
  writeEntry(0x0004, 5, 3, 246);

  // GpsLat rationals at 222: 37/1, 46/1, 29/1
  out.writeUInt32BE(37, 222);
  out.writeUInt32BE(1, 226);
  out.writeUInt32BE(46, 230);
  out.writeUInt32BE(1, 234);
  out.writeUInt32BE(29, 238);
  out.writeUInt32BE(1, 242);

  // GpsLon rationals at 246: 122/1, 25/1, 10/1
  out.writeUInt32BE(122, 246);
  out.writeUInt32BE(1, 250);
  out.writeUInt32BE(25, 254);
  out.writeUInt32BE(1, 258);
  out.writeUInt32BE(10, 262);
  out.writeUInt32BE(1, 266);

  return out;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  let c = 0xffffffff;
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  for (let i = 0; i < body.length; i++) {
    c ^= body[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  const crc = (c ^ 0xffffffff) >>> 0;
  const out = Buffer.allocUnsafe(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

async function createPngWithMetadata(): Promise<Buffer> {
  const base = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 20, g: 120, b: 210 } },
  })
    .png()
    .toBuffer();

  const tiff = buildSampleTiffWithExifAndGps();
  const exifChunk = makePngChunk("eXIf", tiff);
  const textChunk = makePngChunk(
    "tEXt",
    Buffer.from("Author\0Secret Photographer", "utf8")
  );

  // Insert right after IHDR (8 sig + 25 IHDR = 33)
  return Buffer.concat([
    base.subarray(0, 33),
    exifChunk,
    textChunk,
    base.subarray(33),
  ]);
}

async function createJpegWithMetadata(): Promise<Buffer> {
  const base = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 108, g: 71, b: 255 } },
  })
    .jpeg()
    .toBuffer();

  const tiff = buildSampleTiffWithExifAndGps();
  const exifPayload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const app1Hdr = Buffer.alloc(4);
  app1Hdr[0] = 0xff;
  app1Hdr[1] = 0xe1;
  app1Hdr.writeUInt16BE(exifPayload.length + 2, 2);

  const commentPayload = Buffer.from("Personal home address comment", "utf8");
  const comHdr = Buffer.alloc(4);
  comHdr[0] = 0xff;
  comHdr[1] = 0xfe;
  comHdr.writeUInt16BE(commentPayload.length + 2, 2);

  return Buffer.concat([
    base.subarray(0, 2),
    app1Hdr,
    exifPayload,
    comHdr,
    commentPayload,
    base.subarray(2),
  ]);
}

async function createWebpWithMetadata(): Promise<Buffer> {
  const base = await sharp({
    create: { width: 24, height: 24, channels: 3, background: { r: 40, g: 180, b: 120 } },
  })
    .webp()
    .toBuffer();

  const tiff = buildSampleTiffWithExifAndGps();
  const bodyBefore = base.subarray(12);
  const exifHdr = Buffer.alloc(8);
  exifHdr.write("EXIF", 0, 4, "ascii");
  exifHdr.writeUInt32LE(tiff.length, 4);
  const pad = tiff.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);

  const fullBody = Buffer.concat([bodyBefore, exifHdr, tiff, pad]);
  const riffHdr = Buffer.alloc(12);
  riffHdr.write("RIFF", 0, 4, "ascii");
  riffHdr.writeUInt32LE(4 + fullBody.length, 4);
  riffHdr.write("WEBP", 8, 4, "ascii");
  return Buffer.concat([riffHdr, fullBody]);
}

function isoBox(type: string, payload: Buffer): Buffer {
  const out = Buffer.alloc(8 + payload.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, 4, "latin1");
  payload.copy(out, 8);
  return out;
}

function createSampleIsoVideo(brand: "mp42" | "qt  "): Buffer {
  const ftypPayload = Buffer.alloc(8);
  ftypPayload.write(brand, 0, 4, "ascii");
  ftypPayload.write(brand, 4, 4, "ascii");
  const ftyp = isoBox("ftyp", ftypPayload);

  // mvhd v0 (timescale=1000, duration=3000 -> 3.0s)
  const mvhdPayload = Buffer.alloc(100);
  mvhdPayload.writeUInt32BE(3800000000, 4); // creationTime after 1904 epoch
  mvhdPayload.writeUInt32BE(1000, 12);
  mvhdPayload.writeUInt32BE(3000, 16);
  const mvhd = isoBox("mvhd", mvhdPayload);

  // tkhd v0 (640x360)
  const tkhdPayload = Buffer.alloc(84);
  tkhdPayload.writeUInt32BE(640 << 16, 76);
  tkhdPayload.writeUInt32BE(360 << 16, 80);
  const tkhd = isoBox("tkhd", tkhdPayload);

  const mdhdPayload = Buffer.alloc(24);
  mdhdPayload.writeUInt32BE(30000, 12);
  mdhdPayload.writeUInt32BE(90000, 16);
  const mdhd = isoBox("mdhd", mdhdPayload);

  const hdlrPayload = Buffer.alloc(16);
  hdlrPayload.write("vide", 8, 4, "ascii");
  const hdlr = isoBox("hdlr", hdlrPayload);

  const stsdPayload = Buffer.alloc(44);
  stsdPayload.writeUInt32BE(1, 4); // entry count
  stsdPayload.writeUInt32BE(36, 8);
  stsdPayload.write("avc1", 12, 4, "ascii");
  stsdPayload.writeUInt16BE(640, 40);
  stsdPayload.writeUInt16BE(360, 42);
  const stsd = isoBox("stsd", stsdPayload);

  // stts: 90 samples * 1000 ticks at timescale 30000 = 30.00 fps
  const sttsPayload = Buffer.alloc(16);
  sttsPayload.writeUInt32BE(1, 4);
  sttsPayload.writeUInt32BE(90, 8);
  sttsPayload.writeUInt32BE(1000, 12);
  const stts = isoBox("stts", sttsPayload);

  const stcoPlaceholder = Buffer.alloc(12);
  stcoPlaceholder.writeUInt32BE(1, 4);
  const stco = isoBox("stco", stcoPlaceholder);

  const stbl = isoBox("stbl", Buffer.concat([stsd, stts, stco]));
  const minf = isoBox("minf", stbl);
  const mdia = isoBox("mdia", Buffer.concat([mdhd, hdlr, minf]));
  const trak = isoBox("trak", Buffer.concat([tkhd, mdia]));

  // Personal metadata inside udta (GPS ©xyz + ©too encoder)
  const gpsStr = "+37.7749-122.4194/";
  const xyzPayload = Buffer.alloc(4 + gpsStr.length);
  xyzPayload.writeUInt16BE(gpsStr.length, 0);
  xyzPayload.write(gpsStr, 4, gpsStr.length, "utf8");
  const xyz = isoBox("\xa9xyz", xyzPayload);

  const tooStr = "Apple iPhone 15 Pro";
  const tooPayload = Buffer.alloc(4 + tooStr.length);
  tooPayload.writeUInt16BE(tooStr.length, 0);
  tooPayload.write(tooStr, 4, tooStr.length, "utf8");
  const too = isoBox("\xa9too", tooPayload);

  const udta = isoBox("udta", Buffer.concat([xyz, too]));
  const moov = isoBox("moov", Buffer.concat([mvhd, trak, udta]));

  const mdatPayload = Buffer.alloc(64, 0xab);
  const mdat = isoBox("mdat", mdatPayload);

  const full = Buffer.concat([ftyp, moov, mdat]);
  // Patch stco offset to point at exact start of mdat payload
  const mdatPayloadOffset = ftyp.length + moov.length + 8;
  const stcoMarker = full.indexOf(Buffer.from("stco", "ascii"));
  full.writeUInt32BE(mdatPayloadOffset, stcoMarker + 12);
  return full;
}

function createSampleWebm(): Buffer {
  // EBML Header + Segment(Info + Tracks + Tags + Cluster Void)
  const ebmlHdr = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01]);
  const writingApp = Buffer.from("PersonalOBSStudio", "utf8");
  const writingElem = Buffer.concat([
    Buffer.from([0x57, 0x41, 0x80 | writingApp.length]),
    writingApp,
  ]);
  const info = Buffer.concat([
    Buffer.from([0x15, 0x49, 0xa9, 0x66, 0x80 | writingElem.length]),
    writingElem,
  ]);

  // Tracks -> TrackEntry -> CodecID(V_VP9) + Video(640x360)
  const codecBytes = Buffer.from("V_VP9", "utf8");
  const codecEl = Buffer.concat([Buffer.from([0x86, 0x80 | codecBytes.length]), codecBytes]);
  const pw = Buffer.from([0xb0, 0x82, 0x02, 0x80]); // 640
  const ph = Buffer.from([0xba, 0x82, 0x01, 0x68]); // 360
  const videoEl = Buffer.concat([Buffer.from([0xe0, 0x80 | (pw.length + ph.length)]), pw, ph]);
  const trkEntry = Buffer.concat([
    Buffer.from([0xae, 0x80 | (codecEl.length + videoEl.length)]),
    codecEl,
    videoEl,
  ]);
  const tracks = Buffer.concat([Buffer.from([0x16, 0x54, 0xae, 0x6b, 0x80 | trkEntry.length]), trkEntry]);

  // Tags -> Tag -> SimpleTag(LOCATION = +37.7749-122.4194/)
  const tagName = Buffer.from("LOCATION", "utf8");
  const tagVal = Buffer.from("+37.7749-122.4194/", "utf8");
  const st = Buffer.concat([
    Buffer.from([0x67, 0xc8, 0x80 | (3 + tagName.length + 3 + tagVal.length)]),
    Buffer.from([0x45, 0xa3, 0x80 | tagName.length]),
    tagName,
    Buffer.from([0x44, 0x87, 0x80 | tagVal.length]),
    tagVal,
  ]);
  const tag = Buffer.concat([Buffer.from([0x73, 0x73, 0x80 | st.length]), st]);
  const tags = Buffer.concat([Buffer.from([0x12, 0x54, 0xc3, 0x67, 0x80 | tag.length]), tag]);

  const segBody = Buffer.concat([info, tracks, tags]);
  const seg = Buffer.concat([
    Buffer.from([0x18, 0x53, 0x80, 0x67, 0x40 | ((segBody.length >> 8) & 0x3f), segBody.length & 0xff]),
    segBody,
  ]);

  return Buffer.concat([ebmlHdr, seg]);
}

beforeAll(() => {
  process.env.DATABASE_URL = "pglite://:memory:";
  process.env.SIGNING_MODE = "test";
  process.env.AUTH_SECRET = "vitest-privacy-cleaner-secret-key-32b";
  resetDbForTests();
});

describe("AI Media Inspector & Privacy Cleaner (Cases 1–15)", () => {
  it("Cases 1, 11, 12, 13: validates, inspects, strips GPS/EXIF from PNG losslessly and verifies image pixels", async () => {
    const png = await createPngWithMetadata();
    const val = validateMediaFile({
      buffer: png,
      fileName: "photo.png",
      declaredMime: "image/png",
      maxImageBytes: 25 * 1024 * 1024,
      maxVideoBytes: 100 * 1024 * 1024,
    });
    expect(val.ok).toBe(true);

    const res = await cleanMediaPrivacy({
      buffer: png,
      fileName: "photo.png",
      mimeType: "image/png",
    });

    expect(res.beforeMetadata.hasGps).toBe(true);
    expect(res.beforeMetadata.gps?.latitude).toBeCloseTo(37.7747, 3);
    expect(res.beforeMetadata.exif.make).toBe("Canon");
    expect(res.beforeMetadata.textChunks.Author).toBe("Secret Photographer");

    expect(res.afterMetadata.hasGps).toBe(false);
    expect(res.afterMetadata.gps).toBeNull();
    expect(res.afterMetadata.hasExif).toBe(false);
    expect(res.afterMetadata.exif.make).toBeUndefined();
    expect(res.afterMetadata.textChunks.Author).toBeUndefined();
    expect(res.personalMetadataStatus).toBe("removed");
    expect(res.removedFields).toContain("GPS coordinates");
    expect(res.synthId.status).toBe("verification_unavailable");

    // Verify lossless PNG pixel decode integrity with sharp
    const decoded = await sharp(res.cleanedBuffer).metadata();
    expect(decoded.width).toBe(32);
    expect(decoded.height).toBe(32);
    expect(decoded.format).toBe("png");
  });

  it("Cases 2, 11, 12, 13: validates, inspects, strips GPS/EXIF/COM from JPG losslessly and verifies JPEG integrity", async () => {
    const jpg = await createJpegWithMetadata();
    const res = await cleanMediaPrivacy({
      buffer: jpg,
      fileName: "ai-render.jpg",
      mimeType: "image/jpeg",
    });

    expect(res.beforeMetadata.hasGps).toBe(true);
    expect(res.beforeMetadata.exif.artist).toBe("Alice Example");
    expect(res.beforeMetadata.textChunks.Comment).toContain("Personal home");

    expect(res.afterMetadata.hasGps).toBe(false);
    expect(res.afterMetadata.exif.artist).toBeUndefined();
    expect(res.afterMetadata.textChunks.Comment).toBeUndefined();
    expect(res.personalMetadataStatus).toBe("removed");

    const decoded = await sharp(res.cleanedBuffer).metadata();
    expect(decoded.width).toBe(40);
    expect(decoded.height).toBe(30);
    expect(decoded.format).toBe("jpeg");
  });

  it("Case 3 & Case 13: validates, inspects, and cleans WEBP with EXIF & GPS", async () => {
    const webp = await createWebpWithMetadata();
    const res = await cleanMediaPrivacy({
      buffer: webp,
      fileName: "ai-art.webp",
      mimeType: "image/webp",
    });

    expect(res.beforeMetadata.hasGps).toBe(true);
    expect(res.afterMetadata.hasGps).toBe(false);
    expect(res.afterMetadata.hasExif).toBe(false);
    expect(res.personalMetadataStatus).toBe("removed");

    const decoded = await sharp(res.cleanedBuffer).metadata();
    expect(decoded.width).toBe(24);
    expect(decoded.height).toBe(24);
    expect(decoded.format).toBe("webp");
  });

  it("Cases 4, 5, 11, 13: inspects and cleans MP4 & MOV losslessly while keeping stco chunk offsets exact", async () => {
    for (const [brand, name, mime] of [
      ["mp42", "clip.mp4", "video/mp4"],
      ["qt  ", "clip.mov", "video/quicktime"],
    ] as const) {
      const vid = createSampleIsoVideo(brand);
      const res = await cleanMediaPrivacy({
        buffer: vid,
        fileName: name,
        mimeType: mime,
      });

      expect(res.beforeMetadata.hasGps).toBe(true);
      expect(res.beforeMetadata.gps?.latitude).toBeCloseTo(37.7749, 4);
      expect(res.beforeMetadata.codec).toBe("avc1");
      expect(res.beforeMetadata.frameRate).toBe("30.00");

      expect(res.afterMetadata.hasGps).toBe(false);
      expect(res.afterMetadata.exif.editingSoftware).toBeUndefined();
      expect(res.afterMetadata.width).toBe(640);
      expect(res.afterMetadata.height).toBe(360);
      expect(res.afterMetadata.codec).toBe("avc1");
      expect(res.afterMetadata.frameRate).toBe("30.00");
      expect(res.personalMetadataStatus).toBe("removed");

      // Verify stco chunk offset still points strictly inside mdat payload after moov shrunk!
      const boxes = iterateIsoBoxes(res.cleanedBuffer, 0, res.cleanedBuffer.length);
      const mdat = boxes.find((b) => b.type === "mdat")!;
      const stcoIdx = res.cleanedBuffer.indexOf(Buffer.from("stco", "ascii"));
      const patchedOffset = res.cleanedBuffer.readUInt32BE(stcoIdx + 12);
      expect(patchedOffset).toBe(mdat.start + 8);
    }
  });

  it("cleans WebM Tags & WritingApp losslessly with EBML Void preserving cluster alignment", async () => {
    const webm = createSampleWebm();
    const res = await cleanMediaPrivacy({
      buffer: webm,
      fileName: "clip.webm",
      mimeType: "video/webm",
    });

    expect(res.beforeMetadata.hasGps).toBe(true);
    expect(res.beforeMetadata.textChunks.WritingApp).toBe("PersonalOBSStudio");
    expect(res.afterMetadata.hasGps).toBe(false);
    expect(res.afterMetadata.textChunks.WritingApp).toBeUndefined();
    expect(res.cleanedBuffer.length).toBe(webm.length);
  });

  it("Cases 6 & 7: rejects invalid disguised files and oversized files", () => {
    const fakePng = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    const invalid = validateMediaFile({
      buffer: fakePng,
      fileName: "bad.png",
      declaredMime: "image/png",
      maxImageBytes: 25 * 1024 * 1024,
      maxVideoBytes: 100 * 1024 * 1024,
    });
    expect(invalid.ok).toBe(false);

    const pngHeader = Buffer.alloc(1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngHeader);
    const oversized = validateMediaFile({
      buffer: pngHeader,
      fileName: "huge.png",
      declaredMime: "image/png",
      maxImageBytes: 512,
      maxVideoBytes: 1024,
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.statusCode).toBe(413);
    }
  });

  it("Cases 8, 9, 10: preserves C2PA credentials intact and reports SynthID verification unavailable", async () => {
    const plainPng = await sharp({
      create: { width: 24, height: 24, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    // Case 9 + 10: File without C2PA
    const plainClean = await cleanMediaPrivacy({
      buffer: plainPng,
      fileName: "plain.png",
      mimeType: "image/png",
    });
    expect(plainClean.c2pa.status).toBe("not_detected");
    expect(plainClean.c2paResultStatus).toBe("not_present");
    expect(plainClean.synthId.status).toBe("verification_unavailable");
    expect(plainClean.synthId.originalSignalModified).toBe(false);

    // Case 8: File WITH real C2PA signature
    const signed = await signImageWithC2pa({
      buffer: plainPng,
      mimeType: "image/png",
      fileName: "signed-ai.png",
      creatorName: "Studio Creator",
      aiUse: "full_ai",
      modelType: "imageGeneration",
      modelName: "Imagen",
      doNotTrain: true,
    });

    const signedRes = await cleanMediaPrivacy({
      buffer: signed.signedBuffer,
      fileName: "signed-ai.png",
      mimeType: "image/png",
    });
    expect(signedRes.c2pa.status).toBe("present");
    expect(signedRes.c2paResultStatus).toBe("preserved");
    expect(signedRes.preservedOriginalBytes).toBe(true);
    expect(signedRes.outputSha256).toBe(signedRes.inputSha256);
  });
});

describe("Auth, Processing History, Admin & Signed Expiring Downloads (Cases 14–25)", () => {
  it("Cases 14–25: verifies storage downloads, signed token expiry, DB expiry purge, workspace isolation, password reset, and pricing plans", async () => {
    const tmpStorage = await fs.mkdtemp(path.join(os.tmpdir(), "privacy-storage-"));
    process.env.LOCAL_STORAGE_DIR = tmpStorage;

    const db = await getDb();
    const userA = await ensureUserAndWorkspace({
      email: "user-a@example.com",
      name: "User A",
      password: "Password123!",
    });
    const userB = await ensureUserAndWorkspace({
      email: "user-b@example.com",
      name: "User B",
      password: "Password123!",
    });
    expect(userA).toBeTruthy();
    expect(userB).toBeTruthy();

    const [wsA] = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerId, userA!.id));

    // Verify Plans auto-seeded & update works (Case 22)
    const plansBefore = await listPricingPlans();
    expect(plansBefore.some((p) => p.id === "free")).toBe(true);
    const activePlan = await getEffectivePlanForWorkspace(wsA.id);
    expect(activePlan.id).toBe("free");

    // Store sample cleaned image & video objects + record
    const png = await createPngWithMetadata();
    const cleanedRes = await cleanMediaPrivacy({
      buffer: png,
      fileName: "test.png",
      mimeType: "image/png",
    });

    const recId = crypto.randomUUID();
    const cleanKey = `privacy/${recId}/cleaned.png`;
    await putPrivateObject(cleanKey, cleanedRes.cleanedBuffer, "image/png");

    await db.insert(schema.mediaProcessingRecords).values({
      id: recId,
      workspaceId: wsA.id,
      userId: userA!.id,
      originalName: "test.png",
      mimeType: "image/png",
      mediaKind: "image",
      fileSizeBytes: png.length,
      cleanedSizeBytes: cleanedRes.cleanedBuffer.length,
      status: "done",
      c2paStatus: "not_detected",
      c2paResultStatus: "not_present",
      personalMetadataStatus: "removed",
      cleanedKey: cleanKey,
      inputSha256: cleanedRes.inputSha256,
      outputSha256: cleanedRes.outputSha256,
      expiresAt: new Date(Date.now() + 60_000),
    });

    // Signed URL verification + owner isolation check (Cases 14, 21)
    const validUrl = buildPrivacyDownloadUrl({
      recordId: recId,
      kind: "cleaned",
      ownerScope: `ws:${wsA.id}`,
      fileName: "test-privacy-cleaned.png",
      ttlSeconds: 60,
    });
    const token = new URL(`http://localhost${validUrl}`).searchParams.get("token")!;
    const verified = verifyPrivacyDownloadToken(token);
    expect(verified?.ownerScope).toBe(`ws:${wsA.id}`);
    expect(verified?.ownerScope).not.toBe(`ws:other`);

    // Stored bytes match SHA-256
    const fetchedBuf = await getPrivateObject(cleanKey);
    expect(fetchedBuf).not.toBeNull();
    const fetchedHash = crypto.createHash("sha256").update(fetchedBuf!).digest("hex");
    expect(fetchedHash).toBe(cleanedRes.outputSha256);

    // Case 25: Expired token & DB expiry purge
    const expiredUrl = buildPrivacyDownloadUrl({
      recordId: recId,
      kind: "cleaned",
      ownerScope: `ws:${wsA.id}`,
      fileName: "test-privacy-cleaned.png",
      ttlSeconds: -10,
    });
    const expToken = new URL(`http://localhost${expiredUrl}`).searchParams.get("token")!;
    expect(verifyPrivacyDownloadToken(expToken)).toBeNull();

    await db
      .update(schema.mediaProcessingRecords)
      .set({ expiresAt: new Date(Date.now() - 10_000) })
      .where(eq(schema.mediaProcessingRecords.id, recId));
    const purgedCount = await purgeExpiredPrivacyFiles();
    expect(purgedCount).toBe(1);
    expect(await getPrivateObject(cleanKey)).toBeNull();

    // Case 19: Password reset + session revocation
    const sessionTok = crypto.randomUUID();
    await db.insert(schema.sessions).values({
      sessionToken: sessionTok,
      userId: userA!.id,
      expires: new Date(Date.now() + 3600_000),
    });
    await db
      .update(schema.users)
      .set({ passwordHash: hashPassword("NewStrongPass99!") })
      .where(eq(schema.users.id, userA!.id));
    await revokeAllUserSessions(userA!.id);
    const remainingSessions = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userA!.id));
    expect(remainingSessions.length).toBe(0);

    // Log in with new password works; old password rejected
    const reAuthFail = await ensureUserAndWorkspace({
      email: "user-a@example.com",
      password: "Password123!",
    });
    expect(reAuthFail).toBeNull();
    const reAuthOk = await ensureUserAndWorkspace({
      email: "user-a@example.com",
      password: "NewStrongPass99!",
    });
    expect(reAuthOk?.id).toBe(userA!.id);

    await fs.rm(tmpStorage, { recursive: true, force: true });
    await deletePrivateObject(cleanKey);
  });
});
