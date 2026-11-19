import crypto from "node:crypto";
import zlib from "node:zlib";
import { readC2paStoreFromBuffer } from "@/lib/c2pa-server";
import {
  inspectMediaMetadata,
  iterateEbml,
  iterateIsoBoxes,
  parseTiffBinary,
  validateMediaFile,
  type MediaMetadataReport,
  type ParsedTiffTag,
  type SupportedMediaMime,
} from "@/lib/media-metadata";
import {
  isSynthIdVerifierConfigured,
  verifySynthId,
  type SynthIdSummary,
  type SynthIdVerificationStatus,
} from "@/lib/synthid-verifier";

export {
  isSynthIdVerifierConfigured,
  type SynthIdSummary,
  type SynthIdVerificationStatus,
};

export interface PrivacyCleanOptions {
  removeGps: boolean;
  removeCameraInfo: boolean;
  removeExif: boolean;
  removePersonalMetadata: boolean;
  preserveQuality: boolean;
  preserveC2pa: boolean;
}

export const DEFAULT_CLEAN_OPTIONS: PrivacyCleanOptions = {
  removeGps: true,
  removeCameraInfo: true,
  removeExif: true,
  removePersonalMetadata: true,
  preserveQuality: true,
  preserveC2pa: true,
};

export interface C2paInspectionSummary {
  status: "present" | "not_detected" | "unable_to_verify";
  issuer: string | null;
  organization: string | null;
  claimGenerator: string | null;
  signingTime: string | null;
  credentialStatus: "Valid" | "Invalid" | "Unable to verify" | "Not detected";
  provenanceSummary: string | null;
}

export type ProcessingStageKey =
  | "uploaded"
  | "validated"
  | "analysed"
  | "metadata_inspected"
  | "c2pa_inspected"
  | "synthid_attempted"
  | "metadata_cleaned"
  | "output_generated"
  | "output_verified"
  | "download_prepared";

export type ProcessingStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "unavailable"
  | "failed";

export interface ProcessingStageUpdate {
  step: number;
  key: ProcessingStageKey;
  label: string;
  status: ProcessingStageStatus;
  detail?: string;
  durationMs?: number;
  timestamp: string;
}

export class ImageValidationError extends Error {
  statusCode: 400 | 413;
  code: string;

  constructor(message: string, statusCode: 400 | 413 = 400, code = "ERR_INVALID_IMAGE") {
    super(message);
    this.name = "ImageValidationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface PrivacyCleanResult {
  cleanedBuffer: Buffer;
  fileName: string;
  mimeType: SupportedMediaMime;
  mediaKind: "image" | "video";
  inputSha256: string;
  outputSha256: string;
  beforeMetadata: MediaMetadataReport;
  afterMetadata: MediaMetadataReport;
  c2pa: C2paInspectionSummary;
  c2paResultStatus: "preserved" | "not_present" | "unable_to_preserve";
  c2paNotice: string | null;
  synthId: SynthIdSummary;
  personalMetadataStatus: "removed" | "preserved" | "not_available";
  personalMetadataLabel: "Cleaned" | "Already Clean" | "Not Processed";
  removedFields: string[];
  preservedOriginalBytes: boolean;
  outputVerified: boolean;
  dimensionsPreserved: boolean;
  processingTimeMs: number;
  stages: ProcessingStageUpdate[];
}

// ============================================================================
// Pure-JS CRC32 (for lossless PNG chunk updates)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.allocUnsafe(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  if (data.length > 0) data.copy(out, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

// ============================================================================
// Selective Lossless TIFF / EXIF Rebuilder
// ============================================================================

function writeU16(buf: Buffer, off: number, v: number, le: boolean) {
  if (le) buf.writeUInt16LE(v, off);
  else buf.writeUInt16BE(v, off);
}

function writeU32(buf: Buffer, off: number, v: number, le: boolean) {
  if (le) buf.writeUInt32LE(v >>> 0, off);
  else buf.writeUInt32BE(v >>> 0, off);
}

function serializeIfdSection(
  tags: ParsedTiffTag[],
  sectionOffset: number,
  le: boolean
): Buffer {
  const sorted = [...tags].sort((a, b) => a.tag - b.tag);
  const headerSize = 2 + sorted.length * 12 + 4;
  let dataCursor = sectionOffset + headerSize;
  const entriesBuf = Buffer.alloc(headerSize);
  writeU16(entriesBuf, 0, sorted.length, le);

  const dataBlocks: Buffer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const eo = 2 + i * 12;
    writeU16(entriesBuf, eo, t.tag, le);
    writeU16(entriesBuf, eo + 2, t.type, le);
    writeU32(entriesBuf, eo + 4, t.count, le);

    if (t.rawValueBytes.length <= 4) {
      t.rawValueBytes.copy(entriesBuf, eo + 8);
    } else {
      writeU32(entriesBuf, eo + 8, dataCursor, le);
      dataBlocks.push(t.rawValueBytes);
      const paddedLen =
        t.rawValueBytes.length + (t.rawValueBytes.length % 2);
      if (paddedLen > t.rawValueBytes.length) {
        dataBlocks.push(Buffer.alloc(1));
      }
      dataCursor += paddedLen;
    }
  }
  // nextIfdOffset = 0 (already 0)
  return Buffer.concat([entriesBuf, ...dataBlocks]);
}

const CAMERA_IFD0_TAGS = new Set([0x010f, 0x0110, 0x013b]);
const CAMERA_EXIF_TAGS = new Set([0xa431, 0xa433, 0xa434, 0xa435]);
const PERSONAL_IFD0_TAGS = new Set([0x010e, 0x0131, 0x013b, 0x013c, 0x8298]);
const PERSONAL_EXIF_TAGS = new Set([0x9286]);

function filterTiffBinary(
  tiff: Buffer,
  options: PrivacyCleanOptions
): Buffer | null {
  if (options.removeExif) return null;
  if (
    !options.removeGps &&
    !options.removeCameraInfo &&
    !options.removePersonalMetadata
  ) {
    return tiff;
  }

  const parsed = parseTiffBinary(tiff);
  if (!parsed) return null;
  const le = parsed.littleEndian;

  const filteredIfd0 = parsed.ifd0.filter((t) => {
    if (t.tag === 0x8769 || t.tag === 0x8825) return false;
    if (options.removeCameraInfo && CAMERA_IFD0_TAGS.has(t.tag)) return false;
    if (options.removePersonalMetadata && PERSONAL_IFD0_TAGS.has(t.tag)) return false;
    return true;
  });

  const filteredExif = parsed.exifIfd.filter((t) => {
    if (options.removeCameraInfo && CAMERA_EXIF_TAGS.has(t.tag)) return false;
    if (options.removePersonalMetadata && PERSONAL_EXIF_TAGS.has(t.tag)) return false;
    return true;
  });

  const filteredGps =
    options.removeGps || options.removePersonalMetadata ? [] : parsed.gpsIfd;

  if (
    filteredIfd0.length === 0 &&
    filteredExif.length === 0 &&
    filteredGps.length === 0
  ) {
    return null;
  }

  // Reserve placeholder pointers in IFD0 so layout sizes are known up-front
  const pointerTags: ParsedTiffTag[] = [];
  if (filteredExif.length > 0) {
    pointerTags.push({
      tag: 0x8769,
      type: 4,
      count: 1,
      rawValueBytes: Buffer.alloc(4),
    });
  }
  if (filteredGps.length > 0) {
    pointerTags.push({
      tag: 0x8825,
      type: 4,
      count: 1,
      rawValueBytes: Buffer.alloc(4),
    });
  }

  const ifd0Combined = [...filteredIfd0, ...pointerTags];
  const ifd0Start = 8;
  const ifd0Size = serializeIfdSection(ifd0Combined, ifd0Start, le).length;

  let cursor = ifd0Start + ifd0Size;
  let exifOffset = 0;
  let exifBuf: Buffer = Buffer.alloc(0);
  if (filteredExif.length > 0) {
    exifOffset = cursor;
    exifBuf = serializeIfdSection(filteredExif, exifOffset, le);
    cursor += exifBuf.length;
  }

  let gpsOffset = 0;
  let gpsBuf: Buffer = Buffer.alloc(0);
  if (filteredGps.length > 0) {
    gpsOffset = cursor;
    gpsBuf = serializeIfdSection(filteredGps, gpsOffset, le);
  }

  for (const pt of pointerTags) {
    if (pt.tag === 0x8769) writeU32(pt.rawValueBytes, 0, exifOffset, le);
    if (pt.tag === 0x8825) writeU32(pt.rawValueBytes, 0, gpsOffset, le);
  }

  const finalIfd0Buf = serializeIfdSection(ifd0Combined, ifd0Start, le);
  const header = Buffer.alloc(8);
  header.write(le ? "II" : "MM", 0, 2, "ascii");
  writeU16(header, 2, 42, le);
  writeU32(header, 4, ifd0Start, le);

  return Buffer.concat([header, finalIfd0Buf, exifBuf, gpsBuf]);
}

function stripGpsFromXmpXml(xml: string): string {
  return xml
    .replace(/<(?:exif:)?GPS[^>]*>[\s\S]*?<\/(?:exif:)?GPS[^>]*>/gi, "")
    .replace(/\sexif:GPS[A-Za-z0-9_]*="[^"]*"/gi, "");
}

// ============================================================================
// Container-Level Lossless Cleaners
// ============================================================================

function cleanJpegLossless(buf: Buffer, options: PrivacyCleanOptions): Buffer {
  const parts: Buffer[] = [buf.subarray(0, 2)]; // SOI FF D8
  let pos = 2;

  while (pos < buf.length) {
    if (buf[pos] !== 0xff) {
      parts.push(buf.subarray(pos));
      break;
    }
    const markerStart = pos;
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) {
      parts.push(buf.subarray(markerStart));
      break;
    }
    const marker = buf[pos];
    pos++;

    // Entropy-coded SOS or EOI -> copy remainder verbatim
    if (marker === 0xda || marker === 0xd9) {
      parts.push(buf.subarray(markerStart));
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      parts.push(buf.subarray(markerStart, pos));
      continue;
    }
    if (pos + 2 > buf.length) {
      parts.push(buf.subarray(markerStart));
      break;
    }

    const segLen = buf.readUInt16BE(pos);
    const segEnd = pos + segLen;
    if (segLen < 2 || segEnd > buf.length) {
      parts.push(buf.subarray(markerStart));
      break;
    }
    const payload = buf.subarray(pos + 2, segEnd);

    if (marker === 0xe1) {
      if (payload.subarray(0, 6).toString("ascii") === "Exif\0\0") {
        const filtered = filterTiffBinary(payload.subarray(6), options);
        if (filtered) {
          const newPayload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), filtered]);
          const hdr = Buffer.allocUnsafe(4);
          hdr[0] = 0xff;
          hdr[1] = 0xe1;
          hdr.writeUInt16BE(newPayload.length + 2, 2);
          parts.push(hdr, newPayload);
        }
        pos = segEnd;
        continue;
      }
      if (
        payload.subarray(0, 29).toString("ascii") ===
        "http://ns.adobe.com/xap/1.0/\0"
      ) {
        if (options.removePersonalMetadata || options.removeExif) {
          pos = segEnd;
          continue;
        }
        if (options.removeGps) {
          const cleanedXml = stripGpsFromXmpXml(
            payload.subarray(29).toString("utf8")
          );
          const newPayload = Buffer.concat([
            Buffer.from("http://ns.adobe.com/xap/1.0/\0", "ascii"),
            Buffer.from(cleanedXml, "utf8"),
          ]);
          const hdr = Buffer.allocUnsafe(4);
          hdr[0] = 0xff;
          hdr[1] = 0xe1;
          hdr.writeUInt16BE(newPayload.length + 2, 2);
          parts.push(hdr, newPayload);
          pos = segEnd;
          continue;
        }
      }
    }

    if (
      (marker === 0xed || marker === 0xfe) &&
      (options.removePersonalMetadata || options.removeExif)
    ) {
      pos = segEnd;
      continue;
    }

    parts.push(buf.subarray(markerStart, segEnd));
    pos = segEnd;
  }

  return Buffer.concat(parts);
}

function shouldDropPngTextKey(
  key: string,
  val: string,
  options: PrivacyCleanOptions
): boolean {
  if (options.removePersonalMetadata || options.removeExif) return true;
  if (
    options.removeCameraInfo &&
    /make|model|camera|lens|serial/i.test(`${key} ${val}`)
  ) {
    return true;
  }
  if (
    options.removeGps &&
    /gps|lat|lon|location|coord/i.test(`${key} ${val}`)
  ) {
    return true;
  }
  return false;
}

function cleanPngLossless(buf: Buffer, options: PrivacyCleanOptions): Buffer {
  const chunks: Buffer[] = [buf.subarray(0, 8)];
  let pos = 8;

  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    if (pos + 12 + len > buf.length) {
      chunks.push(buf.subarray(pos));
      break;
    }
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === "eXIf") {
      const filtered = filterTiffBinary(data, options);
      if (filtered) {
        chunks.push(makePngChunk("eXIf", filtered));
      }
      pos += 12 + len;
      continue;
    }

    if (type === "tIME" && (options.removePersonalMetadata || options.removeExif)) {
      pos += 12 + len;
      continue;
    }

    if (type === "tEXt") {
      const nul = data.indexOf(0);
      const key = nul > 0 ? data.subarray(0, nul).toString("latin1") : "";
      const val = nul > 0 ? data.subarray(nul + 1).toString("utf8") : "";
      if (key === "XML:com.adobe.xmp") {
        if (options.removePersonalMetadata || options.removeExif) {
          pos += 12 + len;
          continue;
        }
        if (options.removeGps) {
          const stripped = stripGpsFromXmpXml(val);
          chunks.push(
            makePngChunk(
              "tEXt",
              Buffer.concat([
                Buffer.from(`${key}\0`, "latin1"),
                Buffer.from(stripped, "utf8"),
              ])
            )
          );
          pos += 12 + len;
          continue;
        }
      } else if (shouldDropPngTextKey(key, val, options)) {
        pos += 12 + len;
        continue;
      }
    }

    if (type === "zTXt" || type === "iTXt") {
      const nul = data.indexOf(0);
      const key = nul > 0 ? data.subarray(0, nul).toString("utf8") : "";
      let val = "";
      try {
        if (type === "zTXt" && nul + 2 <= data.length) {
          val = zlib.inflateSync(data.subarray(nul + 2)).toString("utf8");
        } else if (type === "iTXt" && nul > 0 && nul + 5 < data.length) {
          const compFlag = data[nul + 1];
          const nulLang = data.indexOf(0, nul + 3);
          const nulTrans = nulLang >= 0 ? data.indexOf(0, nulLang + 1) : -1;
          if (nulTrans >= 0) {
            const textBytes = data.subarray(nulTrans + 1);
            val =
              compFlag === 1
                ? zlib.inflateSync(textBytes).toString("utf8")
                : textBytes.toString("utf8");
          }
        }
      } catch {
        val = "";
      }
      if (type === "iTXt" && key === "XML:com.adobe.xmp") {
        if (options.removePersonalMetadata || options.removeExif) {
          pos += 12 + len;
          continue;
        }
        if (options.removeGps && val) {
          const stripped = stripGpsFromXmpXml(val);
          chunks.push(
            makePngChunk(
              "iTXt",
              Buffer.concat([
                Buffer.from(`${key}\0\0\0\0\0`, "utf8"),
                Buffer.from(stripped, "utf8"),
              ])
            )
          );
          pos += 12 + len;
          continue;
        }
      } else if (shouldDropPngTextKey(key, val, options)) {
        pos += 12 + len;
        continue;
      }
    }

    chunks.push(buf.subarray(pos, pos + 12 + len));
    pos += 12 + len;
    if (type === "IEND") break;
  }

  return Buffer.concat(chunks);
}

function cleanWebpLossless(buf: Buffer, options: PrivacyCleanOptions): Buffer {
  const chunks: Array<{ fourcc: string; data: Buffer }> = [];
  let hasRemainingExif = false;
  let hasRemainingXmp = false;
  let pos = 12;

  while (pos + 8 <= buf.length) {
    const fourcc = buf.subarray(pos, pos + 4).toString("ascii");
    const size = buf.readUInt32LE(pos + 4);
    const dataEnd = Math.min(buf.length, pos + 8 + size);
    const data = Buffer.from(buf.subarray(pos + 8, dataEnd));
    pos += 8 + size + (size % 2);

    if (fourcc === "EXIF") {
      const hasPrefix = data.subarray(0, 6).toString("ascii") === "Exif\0\0";
      const filtered = filterTiffBinary(hasPrefix ? data.subarray(6) : data, options);
      if (filtered) {
        hasRemainingExif = true;
        chunks.push({
          fourcc: "EXIF",
          data: hasPrefix
            ? Buffer.concat([Buffer.from("Exif\0\0", "ascii"), filtered])
            : filtered,
        });
      }
      continue;
    }

    if (fourcc === "XMP ") {
      if (options.removePersonalMetadata || options.removeExif) continue;
      if (options.removeGps) {
        hasRemainingXmp = true;
        chunks.push({
          fourcc: "XMP ",
          data: Buffer.from(stripGpsFromXmpXml(data.toString("utf8")), "utf8"),
        });
        continue;
      }
      hasRemainingXmp = true;
    }

    chunks.push({ fourcc, data });
  }

  // Update VP8X flags if EXIF or XMP was removed
  const outParts: Buffer[] = [];
  for (const c of chunks) {
    const chunkData = Buffer.from(c.data);
    if (c.fourcc === "VP8X" && chunkData.length >= 1) {
      if (!hasRemainingExif) chunkData[0] &= ~0x08;
      if (!hasRemainingXmp) chunkData[0] &= ~0x04;
    }
    const hdr = Buffer.allocUnsafe(8);
    hdr.write(c.fourcc, 0, 4, "ascii");
    hdr.writeUInt32LE(chunkData.length, 4);
    outParts.push(hdr, chunkData);
    if (chunkData.length % 2 === 1) {
      outParts.push(Buffer.from([0x00]));
    }
  }

  const body = Buffer.concat(outParts);
  const riffHdr = Buffer.allocUnsafe(12);
  riffHdr.write("RIFF", 0, 4, "ascii");
  riffHdr.writeUInt32LE(4 + body.length, 4);
  riffHdr.write("WEBP", 8, 4, "ascii");
  return Buffer.concat([riffHdr, body]);
}

function wrapIsoBox(type: string, payload: Buffer): Buffer {
  const out = Buffer.allocUnsafe(8 + payload.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, 4, "latin1");
  payload.copy(out, 8);
  return out;
}

const ISO_META_BOXES = new Set(["udta", "meta", "XMP_"]);

function rebuildMoovWithoutMetadata(
  buf: Buffer,
  start: number,
  end: number,
  stripMeta: boolean
): Buffer {
  const kids = iterateIsoBoxes(buf, start, end);
  const built: Buffer[] = [];

  for (const box of kids) {
    if (stripMeta && ISO_META_BOXES.has(box.type)) {
      continue;
    }
    const pStart = box.start + box.headerSize;
    if (["trak", "mdia", "minf", "stbl"].includes(box.type)) {
      const inner = rebuildMoovWithoutMetadata(buf, pStart, box.end, stripMeta);
      built.push(wrapIsoBox(box.type, inner));
    } else {
      built.push(buf.subarray(box.start, box.end));
    }
  }
  return Buffer.concat(built);
}

function patchChunkOffsetsInMoov(
  moovBuf: Buffer,
  mdatOrigStart: number,
  delta: number
): void {
  if (delta === 0) return;

  const walk = (start: number, end: number) => {
    for (const box of iterateIsoBoxes(moovBuf, start, end)) {
      const pStart = box.start + box.headerSize;
      if (["trak", "mdia", "minf", "stbl"].includes(box.type)) {
        walk(pStart, box.end);
      } else if (box.type === "stco" && box.end - pStart >= 8) {
        const count = moovBuf.readUInt32BE(pStart + 4);
        for (let i = 0; i < count && pStart + 8 + (i + 1) * 4 <= box.end; i++) {
          const off = moovBuf.readUInt32BE(pStart + 8 + i * 4);
          if (off >= mdatOrigStart) {
            moovBuf.writeUInt32BE(Math.max(0, off + delta), pStart + 8 + i * 4);
          }
        }
      } else if (box.type === "co64" && box.end - pStart >= 8) {
        const count = moovBuf.readUInt32BE(pStart + 4);
        for (let i = 0; i < count && pStart + 8 + (i + 1) * 8 <= box.end; i++) {
          const off = Number(moovBuf.readBigUInt64BE(pStart + 8 + i * 8));
          if (off >= mdatOrigStart) {
            moovBuf.writeBigUInt64BE(
              BigInt(Math.max(0, off + delta)),
              pStart + 8 + i * 8
            );
          }
        }
      }
    }
  };

  walk(8, moovBuf.length);
}

function cleanIsoBmffLossless(
  buf: Buffer,
  options: PrivacyCleanOptions
): Buffer {
  const stripMeta =
    options.removeGps ||
    options.removeCameraInfo ||
    options.removeExif ||
    options.removePersonalMetadata;
  if (!stripMeta) return buf;

  const topBoxes = iterateIsoBoxes(buf, 0, buf.length);
  const mdatBox = topBoxes.find((b) => b.type === "mdat");
  const mdatOrigStart = mdatBox ? mdatBox.start : Number.MAX_SAFE_INTEGER;

  let shiftBeforeMdat = 0;
  const outBoxes: Buffer[] = [];
  let moovIndex = -1;

  for (const box of topBoxes) {
    if (ISO_META_BOXES.has(box.type)) {
      if (box.start < mdatOrigStart) {
        shiftBeforeMdat -= box.end - box.start;
      }
      continue;
    }

    if (box.type === "moov") {
      const inner = rebuildMoovWithoutMetadata(
        buf,
        box.start + box.headerSize,
        box.end,
        true
      );
      const newMoov = wrapIsoBox("moov", inner);
      if (box.start < mdatOrigStart) {
        shiftBeforeMdat += newMoov.length - (box.end - box.start);
      }
      moovIndex = outBoxes.length;
      outBoxes.push(newMoov);
      continue;
    }

    outBoxes.push(buf.subarray(box.start, box.end));
  }

  if (moovIndex >= 0 && shiftBeforeMdat !== 0 && mdatBox) {
    const moovCopy = Buffer.from(outBoxes[moovIndex]);
    patchChunkOffsetsInMoov(moovCopy, mdatOrigStart, shiftBeforeMdat);
    outBoxes[moovIndex] = moovCopy;
  }

  return Buffer.concat(outBoxes);
}

function makeEbmlVoid(totalBytes: number): Buffer {
  const out = Buffer.alloc(totalBytes, 0);
  if (totalBytes < 2) return out;
  out[0] = 0xec; // EBML Void ID
  if (totalBytes - 2 <= 126) {
    out[1] = 0x80 | (totalBytes - 2);
  } else if (totalBytes - 3 <= 16382) {
    const payload = totalBytes - 3;
    out[1] = 0x40 | ((payload >> 8) & 0x3f);
    out[2] = payload & 0xff;
  } else {
    const payload = totalBytes - 5;
    out[1] = 0x10 | ((payload >> 24) & 0x0f);
    out[2] = (payload >> 16) & 0xff;
    out[3] = (payload >> 8) & 0xff;
    out[4] = payload & 0xff;
  }
  return out;
}

function cleanWebmLossless(buf: Buffer, options: PrivacyCleanOptions): Buffer {
  const stripMeta =
    options.removeGps ||
    options.removeCameraInfo ||
    options.removeExif ||
    options.removePersonalMetadata;
  if (!stripMeta) return buf;

  const out = Buffer.from(buf);
  const top = iterateEbml(out, 0, out.length);
  const segment = top.find((e) => e.id === 0x18538067);
  if (!segment) return out;

  for (const el of iterateEbml(out, segment.start + segment.headerSize, segment.end)) {
    // Strip Tags (0x1254C367) cleanly via identical-length EBML Void padding
    if (el.id === 0x1254c367) {
      makeEbmlVoid(el.end - el.start).copy(out, el.start);
    }
    // Strip MuxingApp / WritingApp inside Info if personal metadata removal requested
    if (el.id === 0x1549a966 && (options.removePersonalMetadata || options.removeExif)) {
      for (const infoEl of iterateEbml(out, el.start + el.headerSize, el.end)) {
        if ((infoEl.id === 0x4d80 || infoEl.id === 0x5741) && infoEl.end - infoEl.start >= 2) {
          makeEbmlVoid(infoEl.end - infoEl.start).copy(out, infoEl.start);
        }
      }
    }
  }
  return out;
}

// ============================================================================
// C2PA Store Summary Extractor + Diff Calculator
// ============================================================================

async function inspectC2paServerSummary(
  buf: Buffer,
  mimeType: SupportedMediaMime,
  hasC2paBoxHint: boolean
): Promise<C2paInspectionSummary> {
  try {
    const found = await readC2paStoreFromBuffer(buf, mimeType);
    if (!found || !found.activeManifest) {
      if (hasC2paBoxHint) {
        return {
          status: "unable_to_verify",
          issuer: null,
          organization: null,
          claimGenerator: null,
          signingTime: null,
          credentialStatus: "Unable to verify",
          provenanceSummary: "C2PA container box present but manifest store could not be decoded.",
        };
      }
      return {
        status: "not_detected",
        issuer: null,
        organization: null,
        claimGenerator: null,
        signingTime: null,
        credentialStatus: "Not detected",
        provenanceSummary: null,
      };
    }

    const active = found.activeManifest as Record<string, unknown>;
    const sigInfo = (active.signature_info || {}) as Record<string, unknown>;
    const issuer = typeof sigInfo.issuer === "string" ? sigInfo.issuer : null;
    const org = typeof sigInfo.common_name === "string" ? sigInfo.common_name : issuer;
    const claimGen =
      typeof active.claim_generator === "string" ? active.claim_generator : null;
    const signingTime =
      typeof sigInfo.time === "string" ? sigInfo.time : null;

    const statuses = Array.isArray(found.store?.validation_status)
      ? (found.store.validation_status as Array<{ code?: string }>)
      : [];
    const hardInvalid = statuses.some((s) => {
      const code = (s.code || "").toLowerCase();
      return (
        code.includes("mismatch") ||
        code.includes("invalid") ||
        code.includes("corrupt") ||
        code.includes("untampered") === false && code.includes("hash")
      );
    });
    const untrustedOnly = statuses.some((s) =>
      (s.code || "").toLowerCase().includes("untrusted")
    );

    const validationStateRaw = String(found.store?.validation_state || "");
    let credentialStatus: "Valid" | "Invalid" | "Unable to verify" = "Valid";
    if (hardInvalid || validationStateRaw === "Invalid") {
      credentialStatus = "Invalid";
    } else if (untrustedOnly) {
      credentialStatus = "Unable to verify";
    }

    const assertions = Array.isArray(active.assertions) ? active.assertions : [];
    const labels = assertions
      .map((a: { label?: string }) => a?.label)
      .filter((x): x is string => Boolean(x));

    return {
      status: "present",
      issuer,
      organization: org,
      claimGenerator: claimGen,
      signingTime,
      credentialStatus,
      provenanceSummary:
        labels.length > 0
          ? `Manifest assertions: ${labels.slice(0, 6).join(", ")}`
          : "C2PA provenance manifest present",
    };
  } catch {
    if (hasC2paBoxHint) {
      return {
        status: "unable_to_verify",
        issuer: null,
        organization: null,
        claimGenerator: null,
        signingTime: null,
        credentialStatus: "Unable to verify",
        provenanceSummary: "C2PA container detected; verification unavailable for this container.",
      };
    }
    return {
      status: "not_detected",
      issuer: null,
      organization: null,
      claimGenerator: null,
      signingTime: null,
      credentialStatus: "Not detected",
      provenanceSummary: null,
    };
  }
}

function diffRemovedFields(
  before: MediaMetadataReport,
  after: MediaMetadataReport
): string[] {
  const removed: string[] = [];
  if (before.hasGps && !after.hasGps) removed.push("GPS coordinates");
  if (before.exif.make && !after.exif.make) removed.push("Camera make");
  if (before.exif.model && !after.exif.model) removed.push("Camera model");
  if (before.exif.lensModel && !after.exif.lensModel) removed.push("Lens information");
  if (before.exif.artist && !after.exif.artist) removed.push("Creator / Artist");
  if (before.exif.copyright && !after.exif.copyright) removed.push("Copyright");
  if (
    (before.exif.software || before.exif.editingSoftware) &&
    !after.exif.software &&
    !after.exif.editingSoftware
  ) {
    removed.push("Software / Editing tool");
  }
  if (
    (before.exif.createDate || before.exif.dateTimeOriginal) &&
    !after.exif.createDate &&
    !after.exif.dateTimeOriginal
  ) {
    removed.push("Creation timestamp");
  }
  if (Object.keys(before.xmp).length > 0 && Object.keys(after.xmp).length === 0) {
    removed.push("XMP metadata block");
  }
  for (const k of Object.keys(before.textChunks)) {
    if (!(k in after.textChunks)) {
      removed.push(`Embedded tag: ${k}`);
    }
  }
  if (before.hasExif && !after.hasExif && removed.length === 0) {
    removed.push("EXIF segment");
  }
  return removed;
}

// ============================================================================
// Pixel-Level Image Integrity Verifier & 10-Stage Orchestrator
// ============================================================================

const EXPECTED_SHARP_FORMAT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Processing cancelled by user.");
    err.name = "AbortError";
    throw err;
  }
}

export async function verifyImageIntegrity(
  buf: Buffer,
  expectedMime: SupportedMediaMime
): Promise<{ width: number; height: number; format: string }> {
  const expectedFormat = EXPECTED_SHARP_FORMAT[expectedMime];
  if (!expectedFormat) {
    throw new ImageValidationError(
      `Unsupported image MIME type "${expectedMime}".`,
      400,
      "ERR_UNSUPPORTED_MIME"
    );
  }

  try {
    const sharp = (await import("sharp")).default;
    const instance = sharp(buf, {
      failOn: "truncated",
      limitInputPixels: 100_000_000,
    });
    const meta = await instance.metadata();
    // Force full scanline decoding so truncated or corrupt compressed pixel payloads fail reliably
    await sharp(buf, {
      failOn: "truncated",
      limitInputPixels: 100_000_000,
    }).stats();

    if (
      !meta.width ||
      !meta.height ||
      meta.width <= 0 ||
      meta.height <= 0 ||
      meta.format !== expectedFormat
    ) {
      throw new ImageValidationError(
        "Image file is corrupted or truncated and could not be decoded.",
        400,
        "ERR_CORRUPTED_IMAGE"
      );
    }

    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
    };
  } catch (err) {
    if (err instanceof ImageValidationError) throw err;
    throw new ImageValidationError(
      "Image file is corrupted or truncated and could not be decoded.",
      400,
      "ERR_CORRUPTED_IMAGE"
    );
  }
}

export async function cleanMediaPrivacy(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: SupportedMediaMime;
  options?: Partial<PrivacyCleanOptions>;
  onStage?: (stage: ProcessingStageUpdate) => void;
  signal?: AbortSignal;
  initialStages?: ProcessingStageUpdate[];
}): Promise<PrivacyCleanResult> {
  const runStart = Date.now();
  const options: PrivacyCleanOptions = {
    ...DEFAULT_CLEAN_OPTIONS,
    ...(params.options || {}),
    preserveC2pa: true, // Always enforce C2PA preservation guardrail
  };

  const stages: ProcessingStageUpdate[] = params.initialStages
    ? [...params.initialStages]
    : [];

  const emitStage = (update: ProcessingStageUpdate) => {
    const idx = stages.findIndex((s) => s.key === update.key);
    if (idx >= 0) stages[idx] = update;
    else stages.push(update);
    params.onStage?.(update);
  };

  async function runStage<T>(
    step: number,
    key: ProcessingStageKey,
    label: string,
    fn: () => Promise<{ result: T; status?: ProcessingStageStatus; detail?: string }>
  ): Promise<T> {
    checkAborted(params.signal);
    const t0 = Date.now();
    emitStage({
      step,
      key,
      label,
      status: "running",
      timestamp: new Date().toISOString(),
    });
    try {
      const out = await fn();
      emitStage({
        step,
        key,
        label,
        status: out.status ?? "completed",
        detail: out.detail,
        durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      });
      return out.result;
    } catch (err) {
      emitStage({
        step,
        key,
        label,
        status: "failed",
        detail: err instanceof Error ? err.message : "Stage failed",
        durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  }

  const isImageMime = params.mimeType.startsWith("image/");

  // Stage 2: Validate file container & decode image integrity
  const beforeDims = await runStage(2, "validated", "File validated", async () => {
    const val = validateMediaFile({
      buffer: params.buffer,
      fileName: params.fileName,
      declaredMime: params.mimeType,
      maxImageBytes: 512 * 1024 * 1024,
      maxVideoBytes: 1024 * 1024 * 1024,
    });
    if (!val.ok) {
      throw new ImageValidationError(val.error, val.statusCode, val.code);
    }
    const dims = isImageMime
      ? await verifyImageIntegrity(params.buffer, params.mimeType)
      : null;
    return {
      result: dims,
      detail: dims
        ? `Verified ${dims.format.toUpperCase()} (${dims.width}×${dims.height})`
        : `Verified ${val.mimeType}`,
    };
  });

  // Stage 3: Image analysed & input fingerprint
  const inputSha256 = await runStage(3, "analysed", "Image analysed", async () => {
    const sha = crypto.createHash("sha256").update(params.buffer).digest("hex");
    return {
      result: sha,
      detail: beforeDims
        ? `${beforeDims.width}×${beforeDims.height} px • ${params.buffer.length} bytes`
        : `${params.buffer.length} bytes`,
    };
  });

  // Stage 4: Metadata inspected
  const beforeMetadata = await runStage(
    4,
    "metadata_inspected",
    "Metadata inspected",
    async () => {
      const report = inspectMediaMetadata(
        params.buffer,
        params.fileName,
        params.mimeType
      );
      if (beforeDims) {
        report.width = report.width ?? beforeDims.width;
        report.height = report.height ?? beforeDims.height;
      }
      return {
        result: report,
        detail: `${report.rawTagCount} metadata tags detected${report.hasGps ? " (includes GPS)" : ""}`,
      };
    }
  );

  // Stage 5: C2PA credentials inspected
  const c2pa = await runStage(
    5,
    "c2pa_inspected",
    "C2PA credentials inspected",
    async () => {
      const summary = await inspectC2paServerSummary(
        params.buffer,
        params.mimeType,
        beforeMetadata.hasC2paBox
      );
      return {
        result: summary,
        detail:
          summary.status === "present"
            ? `${summary.credentialStatus}${summary.issuer ? ` (${summary.issuer})` : ""}`
            : summary.credentialStatus,
      };
    }
  );

  // Stage 6: SynthID verification attempted where configured/supported
  const synthId = await runStage(
    6,
    "synthid_attempted",
    "SynthID verification attempted",
    async () => {
      const res = await verifySynthId({
        buffer: params.buffer,
        mimeType: params.mimeType,
        fileName: params.fileName,
        sha256: inputSha256,
        signal: params.signal,
      });
      return {
        result: res,
        status: res.available ? "completed" : "unavailable",
        detail: res.label,
      };
    }
  );

  // Stage 7: Selected privacy metadata cleaned (strictly preserving C2PA)
  const preservedOriginalBytes = c2pa.status !== "not_detected";
  const anyCleanRequested =
    options.removeGps ||
    options.removeCameraInfo ||
    options.removeExif ||
    options.removePersonalMetadata;

  const cleanedBuffer = await runStage(
    7,
    "metadata_cleaned",
    "Selected privacy metadata cleaned",
    async () => {
      if (preservedOriginalBytes) {
        return {
          result: params.buffer,
          status: "skipped",
          detail: "Original bytes preserved to protect C2PA signature integrity",
        };
      }
      if (!anyCleanRequested) {
        return {
          result: params.buffer,
          status: "skipped",
          detail: "Skipped per selected cleaning options",
        };
      }

      let out = params.buffer;
      if (params.mimeType === "image/jpeg") {
        out = cleanJpegLossless(params.buffer, options);
      } else if (params.mimeType === "image/png") {
        out = cleanPngLossless(params.buffer, options);
      } else if (params.mimeType === "image/webp") {
        out = cleanWebpLossless(params.buffer, options);
      } else if (
        params.mimeType === "video/mp4" ||
        params.mimeType === "video/quicktime"
      ) {
        out = cleanIsoBmffLossless(params.buffer, options);
      } else if (params.mimeType === "video/webm") {
        out = cleanWebmLossless(params.buffer, options);
      }

      return {
        result: out,
        status: "completed",
        detail: `Container metadata processed (${out.length} bytes)`,
      };
    }
  );

  // Stage 8: Output file generated
  const outputSha256 = await runStage(
    8,
    "output_generated",
    "Output file generated",
    async () => {
      if (!cleanedBuffer || cleanedBuffer.length === 0) {
        throw new Error("Generated output file is empty.");
      }
      const sha = crypto.createHash("sha256").update(cleanedBuffer).digest("hex");
      return {
        result: sha,
        detail: `${cleanedBuffer.length} bytes (${params.mimeType})`,
      };
    }
  );

  // Stage 9: Output integrity & dimension preservation verified
  const verifiedOut = await runStage(
    9,
    "output_verified",
    "Output integrity verified",
    async () => {
      const postValidation = validateMediaFile({
        buffer: cleanedBuffer,
        fileName: params.fileName,
        declaredMime: params.mimeType,
        maxImageBytes: 512 * 1024 * 1024,
        maxVideoBytes: 1024 * 1024 * 1024,
      });
      if (!postValidation.ok) {
        throw new Error(`Post-clean verification failed: ${postValidation.error}`);
      }

      let afterDims: { width: number; height: number; format: string } | null = null;
      if (isImageMime) {
        afterDims = await verifyImageIntegrity(cleanedBuffer, params.mimeType);
        if (
          beforeDims &&
          (afterDims.width !== beforeDims.width ||
            afterDims.height !== beforeDims.height)
        ) {
          throw new Error(
            "Post-clean verification failed: image dimensions changed during processing."
          );
        }
      }

      const afterMetadata = inspectMediaMetadata(
        cleanedBuffer,
        params.fileName,
        params.mimeType
      );
      if (afterDims) {
        afterMetadata.width = afterMetadata.width ?? afterDims.width;
        afterMetadata.height = afterMetadata.height ?? afterDims.height;
      }

      if (
        beforeMetadata.width &&
        beforeMetadata.height &&
        (!afterMetadata.width ||
          !afterMetadata.height ||
          afterMetadata.width !== beforeMetadata.width ||
          afterMetadata.height !== beforeMetadata.height)
      ) {
        throw new Error(
          "Post-clean verification failed: media dimensions could not be verified."
        );
      }

      const removedFields = diffRemovedFields(beforeMetadata, afterMetadata);
      const hadMetadata =
        beforeMetadata.hasExif ||
        beforeMetadata.hasGps ||
        beforeMetadata.hasCameraInfo ||
        beforeMetadata.hasPersonalMetadata ||
        beforeMetadata.rawTagCount > 0;

      let personalMetadataStatus: "removed" | "preserved" | "not_available" =
        "not_available";
      let personalMetadataLabel: "Cleaned" | "Already Clean" | "Not Processed" =
        "Already Clean";

      if (removedFields.length > 0) {
        personalMetadataStatus = "removed";
        personalMetadataLabel = "Cleaned";
      } else if (preservedOriginalBytes || hadMetadata) {
        personalMetadataStatus = "preserved";
        personalMetadataLabel = "Not Processed";
      }

      const dimText =
        afterMetadata.width && afterMetadata.height
          ? `${afterMetadata.width}×${afterMetadata.height} px verified`
          : "Container verified";

      return {
        result: {
          afterMetadata,
          removedFields,
          personalMetadataStatus,
          personalMetadataLabel,
        },
        detail: `${dimText} • ${removedFields.length} fields removed`,
      };
    }
  );

  const c2paResultStatus: PrivacyCleanResult["c2paResultStatus"] =
    c2pa.status === "not_detected"
      ? "not_present"
      : c2pa.status === "present"
        ? "preserved"
        : "unable_to_preserve";

  return {
    cleanedBuffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    mediaKind: beforeMetadata.mediaKind,
    inputSha256,
    outputSha256,
    beforeMetadata,
    afterMetadata: verifiedOut.afterMetadata,
    c2pa,
    c2paResultStatus,
    c2paNotice: preservedOriginalBytes
      ? "This file contains C2PA Content Credentials whose cryptographic hash covers the file's bytes. To preserve authenticity and avoid invalidating the credential signature, original bytes were kept intact."
      : null,
    synthId,
    personalMetadataStatus: verifiedOut.personalMetadataStatus,
    personalMetadataLabel: verifiedOut.personalMetadataLabel,
    removedFields: verifiedOut.removedFields,
    preservedOriginalBytes,
    outputVerified: true,
    dimensionsPreserved: true,
    processingTimeMs: Date.now() - runStart,
    stages,
  };
}
