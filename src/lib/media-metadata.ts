import zlib from "node:zlib";
import { detectRealMimeType } from "@/lib/security";

export type SupportedMediaMime =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";

export const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp4",
  ".mov",
  ".webm",
]);

export interface ExifSummary {
  make?: string;
  model?: string;
  lensModel?: string;
  software?: string;
  editingSoftware?: string;
  createDate?: string;
  dateTimeOriginal?: string;
  artist?: string;
  copyright?: string;
  orientation?: number;
  extraTags: Record<string, string | number>;
}

export interface GpsSummary {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  rawIso6709?: string;
}

export interface VideoSummary {
  container: string;
  codec?: string;
  durationSec?: number;
  frameRate?: string;
  bitrateKbps?: number;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  creationTime?: string;
  encoder?: string;
  location?: string;
  deviceMake?: string;
  deviceModel?: string;
}

export interface MediaMetadataReport {
  format: string;
  mimeType: SupportedMediaMime;
  mediaKind: "image" | "video";
  fileSizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  codec?: string;
  frameRate?: string;
  hasExif: boolean;
  hasGps: boolean;
  hasCameraInfo: boolean;
  hasPersonalMetadata: boolean;
  hasC2paBox: boolean;
  iptcBytes?: number;
  exif: ExifSummary;
  gps: GpsSummary | null;
  xmp: Record<string, string>;
  textChunks: Record<string, string>;
  video: VideoSummary | null;
  rawTagCount: number;
}

export type ValidationResult =
  | {
      ok: true;
      mimeType: SupportedMediaMime;
      mediaKind: "image" | "video";
      extension: string;
    }
  | {
      ok: false;
      statusCode: 400 | 413;
      code: string;
      error: string;
    };

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx).toLowerCase();
}

export function validateMediaFile(params: {
  buffer: Buffer;
  fileName: string;
  declaredMime?: string;
  maxImageBytes: number;
  maxVideoBytes: number;
}): ValidationResult {
  const { buffer, fileName, maxImageBytes, maxVideoBytes } = params;
  const ext = getExtension(fileName);

  if (!buffer || buffer.length < 12) {
    return {
      ok: false,
      statusCode: 400,
      code: "ERR_EMPTY_OR_CORRUPT",
      error: "File is empty or truncated and cannot be inspected.",
    };
  }

  // Reject HTML / SVG / active script polyglots
  const headText = buffer
    .subarray(0, Math.min(buffer.length, 512))
    .toString("utf8")
    .trimStart()
    .toLowerCase();
  if (
    headText.startsWith("<html") ||
    headText.startsWith("<!doctype") ||
    headText.startsWith("<script") ||
    headText.startsWith("<svg") ||
    headText.includes("<script")
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: "ERR_UNSAFE_FILE",
      error: "Unsupported active-script or HTML content detected.",
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      statusCode: 400,
      code: "ERR_UNSUPPORTED_EXTENSION",
      error: `Unsupported file extension "${ext || "none"}". Supported: PNG, JPG, JPEG, WEBP, MP4, MOV, WEBM.`,
    };
  }

  const realMime = detectRealMimeType(buffer);
  if (
    !realMime ||
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ].includes(realMime)
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: "ERR_INVALID_MAGIC_BYTES",
      error: "File signature does not match a valid PNG, JPG, WEBP, MP4, MOV, or WEBM media file.",
    };
  }

  const typedMime = realMime as SupportedMediaMime;
  const mediaKind = typedMime.startsWith("video/") ? "video" : "image";

  // Verify extension matches actual container family
  const extIsImage = [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
  const extIsVideo = [".mp4", ".mov", ".webm"].includes(ext);
  if (
    (mediaKind === "image" && !extIsImage) ||
    (mediaKind === "video" && !extIsVideo) ||
    (ext === ".png" && typedMime !== "image/png") ||
    ((ext === ".jpg" || ext === ".jpeg") && typedMime !== "image/jpeg") ||
    (ext === ".webp" && typedMime !== "image/webp") ||
    (ext === ".webm" && typedMime !== "video/webm") ||
    ((ext === ".mp4" || ext === ".mov") &&
      typedMime !== "video/mp4" &&
      typedMime !== "video/quicktime")
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: "ERR_EXTENSION_MIME_MISMATCH",
      error: `File extension "${ext}" does not match the actual ${typedMime} file header.`,
    };
  }

  const maxAllowed = mediaKind === "video" ? maxVideoBytes : maxImageBytes;
  if (buffer.length > maxAllowed) {
    const limitMb = Math.round(maxAllowed / (1024 * 1024));
    return {
      ok: false,
      statusCode: 413,
      code: "ERR_FILE_TOO_LARGE",
      error: `File exceeds the ${limitMb} MB limit for ${mediaKind} files on your current plan.`,
    };
  }

  return {
    ok: true,
    mimeType: typedMime,
    mediaKind,
    extension: ext,
  };
}

// ============================================================================
// TIFF / EXIF IFD Binary Parser
// ============================================================================

const TIFF_TYPE_SIZE: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

export interface ParsedTiffTag {
  tag: number;
  type: number;
  count: number;
  rawValueBytes: Buffer;
}

export interface ParsedTiffStructure {
  littleEndian: boolean;
  ifd0: ParsedTiffTag[];
  exifIfd: ParsedTiffTag[];
  gpsIfd: ParsedTiffTag[];
}

function readU16(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
}

function readU32(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readUInt32LE(off) : buf.readUInt32BE(off);
}

function readI32(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readInt32LE(off) : buf.readInt32BE(off);
}

function readIfdTags(
  tiff: Buffer,
  offset: number,
  le: boolean
): ParsedTiffTag[] {
  if (offset < 8 || offset + 2 > tiff.length) return [];
  const count = readU16(tiff, offset, le);
  if (count > 256 || offset + 2 + count * 12 > tiff.length) return [];

  const result: ParsedTiffTag[] = [];
  for (let i = 0; i < count; i++) {
    const entryOff = offset + 2 + i * 12;
    const tag = readU16(tiff, entryOff, le);
    const type = readU16(tiff, entryOff + 2, le);
    const valCount = readU32(tiff, entryOff + 4, le);
    const elemSize = TIFF_TYPE_SIZE[type] || 1;
    const totalBytes = elemSize * valCount;

    if (totalBytes > 1024 * 1024) continue;

    let rawValueBytes: Buffer;
    if (totalBytes <= 4) {
      rawValueBytes = Buffer.from(tiff.subarray(entryOff + 8, entryOff + 8 + totalBytes));
    } else {
      const valOff = readU32(tiff, entryOff + 8, le);
      if (valOff + totalBytes > tiff.length) continue;
      rawValueBytes = Buffer.from(tiff.subarray(valOff, valOff + totalBytes));
    }

    result.push({ tag, type, count: valCount, rawValueBytes });
  }
  return result;
}

export function parseTiffBinary(tiff: Buffer): ParsedTiffStructure | null {
  if (tiff.length < 8) return null;
  const order = tiff.subarray(0, 2).toString("ascii");
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  if (readU16(tiff, 2, le) !== 42) return null;

  const ifd0Offset = readU32(tiff, 4, le);
  const ifd0 = readIfdTags(tiff, ifd0Offset, le);

  let exifIfd: ParsedTiffTag[] = [];
  let gpsIfd: ParsedTiffTag[] = [];

  for (const t of ifd0) {
    if (t.tag === 0x8769 && t.rawValueBytes.length >= 4) {
      const ptr = readU32(t.rawValueBytes, 0, le);
      exifIfd = readIfdTags(tiff, ptr, le);
    } else if (t.tag === 0x8825 && t.rawValueBytes.length >= 4) {
      const ptr = readU32(t.rawValueBytes, 0, le);
      gpsIfd = readIfdTags(tiff, ptr, le);
    }
  }

  return { littleEndian: le, ifd0, exifIfd, gpsIfd };
}

function decodeTiffAscii(tag: ParsedTiffTag): string {
  return tag.rawValueBytes
    .toString("utf8")
    .replace(/\0+$/g, "")
    .trim();
}

function decodeTiffShort(tag: ParsedTiffTag, le: boolean): number | undefined {
  if (tag.rawValueBytes.length < 2) return undefined;
  return readU16(tag.rawValueBytes, 0, le);
}

function decodeTiffRationals(tag: ParsedTiffTag, le: boolean): number[] {
  const out: number[] = [];
  const signed = tag.type === 10;
  for (let i = 0; i + 8 <= tag.rawValueBytes.length; i += 8) {
    const num = signed
      ? readI32(tag.rawValueBytes, i, le)
      : readU32(tag.rawValueBytes, i, le);
    const den = signed
      ? readI32(tag.rawValueBytes, i + 4, le)
      : readU32(tag.rawValueBytes, i + 4, le);
    out.push(den === 0 ? 0 : num / den);
  }
  return out;
}

function applyTiffIntoReport(tiffBuf: Buffer, report: MediaMetadataReport): void {
  const parsed = parseTiffBinary(tiffBuf);
  if (!parsed) return;
  report.hasExif = true;
  const le = parsed.littleEndian;

  for (const t of parsed.ifd0) {
    if (t.tag === 0x8769 || t.tag === 0x8825) continue;
    report.rawTagCount++;
    switch (t.tag) {
      case 0x010f: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.make = v;
          report.hasCameraInfo = true;
        }
        break;
      }
      case 0x0110: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.model = v;
          report.hasCameraInfo = true;
        }
        break;
      }
      case 0x0112: {
        report.exif.orientation = decodeTiffShort(t, le);
        break;
      }
      case 0x0131: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.software = v;
          report.exif.editingSoftware = report.exif.editingSoftware || v;
        }
        break;
      }
      case 0x0132: {
        const v = decodeTiffAscii(t);
        if (v) report.exif.createDate = report.exif.createDate || v;
        break;
      }
      case 0x013b: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.artist = v;
          report.hasPersonalMetadata = true;
        }
        break;
      }
      case 0x8298: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.copyright = v;
          report.hasPersonalMetadata = true;
        }
        break;
      }
      default: {
        if (t.type === 2) {
          const v = decodeTiffAscii(t);
          if (v) report.exif.extraTags[`0x${t.tag.toString(16)}`] = v;
        }
      }
    }
  }

  for (const t of parsed.exifIfd) {
    report.rawTagCount++;
    switch (t.tag) {
      case 0x9003: {
        const v = decodeTiffAscii(t);
        if (v) report.exif.dateTimeOriginal = v;
        break;
      }
      case 0x9004: {
        const v = decodeTiffAscii(t);
        if (v) report.exif.createDate = v;
        break;
      }
      case 0xa433:
      case 0xa434: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.lensModel = report.exif.lensModel
            ? `${report.exif.lensModel} ${v}`
            : v;
          report.hasCameraInfo = true;
        }
        break;
      }
      case 0xa431:
      case 0xa435: {
        const v = decodeTiffAscii(t);
        if (v) {
          report.exif.extraTags[`serial_${t.tag.toString(16)}`] = v;
          report.hasCameraInfo = true;
          report.hasPersonalMetadata = true;
        }
        break;
      }
      case 0x9286: {
        const v = t.rawValueBytes
          .subarray(t.rawValueBytes.length > 8 ? 8 : 0)
          .toString("utf8")
          .replace(/\0+$/g, "")
          .trim();
        if (v) {
          report.exif.extraTags.UserComment = v;
          report.hasPersonalMetadata = true;
        }
        break;
      }
    }
  }

  if (parsed.gpsIfd.length > 0) {
    let latRef = "N";
    let lonRef = "E";
    let latArr: number[] | null = null;
    let lonArr: number[] | null = null;
    let altRef = 0;
    let altVal: number | undefined;

    for (const t of parsed.gpsIfd) {
      report.rawTagCount++;
      if (t.tag === 0x0001) latRef = decodeTiffAscii(t) || "N";
      if (t.tag === 0x0002) latArr = decodeTiffRationals(t, le);
      if (t.tag === 0x0003) lonRef = decodeTiffAscii(t) || "E";
      if (t.tag === 0x0004) lonArr = decodeTiffRationals(t, le);
      if (t.tag === 0x0005 && t.rawValueBytes.length >= 1) {
        altRef = t.rawValueBytes[0];
      }
      if (t.tag === 0x0006) {
        const nums = decodeTiffRationals(t, le);
        if (nums.length > 0) altVal = nums[0];
      }
    }

    const toDecimal = (dms: number[] | null, ref: string): number | undefined => {
      if (!dms || dms.length === 0) return undefined;
      const d = dms[0] || 0;
      const m = dms[1] || 0;
      const s = dms[2] || 0;
      const val = d + m / 60 + s / 3600;
      const sign = ref.toUpperCase() === "S" || ref.toUpperCase() === "W" ? -1 : 1;
      return Number((val * sign).toFixed(6));
    };

    const lat = toDecimal(latArr, latRef);
    const lon = toDecimal(lonArr, lonRef);
    if (lat !== undefined || lon !== undefined || altVal !== undefined) {
      report.hasGps = true;
      report.hasPersonalMetadata = true;
      report.gps = {
        ...(lat !== undefined ? { latitude: lat } : {}),
        ...(lon !== undefined ? { longitude: lon } : {}),
        ...(altVal !== undefined
          ? { altitude: Number((altRef === 1 ? -altVal : altVal).toFixed(2)) }
          : {}),
      };
    }
  }
}

// ============================================================================
// XMP Extraction Helper
// ============================================================================

function parseXmpXmlIntoReport(xml: string, report: MediaMetadataReport): void {
  const tagMap: Array<[string, RegExp]> = [
    ["CreatorTool", /<(?:xmp:)?CreatorTool[^>]*>([^<]+)<\/(?:xmp:)?CreatorTool>/i],
    ["CreateDate", /<(?:xmp:)?CreateDate[^>]*>([^<]+)<\/(?:xmp:)?CreateDate>/i],
    ["SoftwareAgent", /<(?:stEvt:)?softwareAgent[^>]*>([^<]+)<\/(?:stEvt:)?softwareAgent>/i],
    ["Creator", /<(?:dc:)?creator[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/i],
    ["GPSLatitude", /<(?:exif:)?GPSLatitude[^>]*>([^<]+)<\/(?:exif:)?GPSLatitude>/i],
    ["GPSLongitude", /<(?:exif:)?GPSLongitude[^>]*>([^<]+)<\/(?:exif:)?GPSLongitude>/i],
    ["Make", /<(?:tiff:)?Make[^>]*>([^<]+)<\/(?:tiff:)?Make>/i],
    ["Model", /<(?:tiff:)?Model[^>]*>([^<]+)<\/(?:tiff:)?Model>/i],
  ];

  for (const [key, rx] of tagMap) {
    const m = xml.match(rx);
    if (m?.[1]?.trim()) {
      const val = m[1].trim();
      report.xmp[key] = val;
      report.rawTagCount++;
      report.hasPersonalMetadata = true;
      if (key === "CreatorTool" || key === "SoftwareAgent") {
        report.exif.editingSoftware = report.exif.editingSoftware || val;
      }
      if (key === "CreateDate") {
        report.exif.createDate = report.exif.createDate || val;
      }
      if (key === "Make") {
        report.exif.make = report.exif.make || val;
        report.hasCameraInfo = true;
      }
      if (key === "Model") {
        report.exif.model = report.exif.model || val;
        report.hasCameraInfo = true;
      }
      if (key === "GPSLatitude" || key === "GPSLongitude") {
        report.hasGps = true;
      }
    }
  }

  // Also check attribute syntax exif:GPSLatitude="..."
  const attrLat = xml.match(/exif:GPSLatitude="([^"]+)"/i);
  const attrLon = xml.match(/exif:GPSLongitude="([^"]+)"/i);
  if (attrLat?.[1]) {
    report.xmp.GPSLatitude = attrLat[1];
    report.hasGps = true;
    report.hasPersonalMetadata = true;
  }
  if (attrLon?.[1]) {
    report.xmp.GPSLongitude = attrLon[1];
    report.hasGps = true;
    report.hasPersonalMetadata = true;
  }
}

// ============================================================================
// ISO 6709 GPS Parser (MP4 / MOV)
// ============================================================================

function parseIso6709(raw: string): GpsSummary | null {
  const m = raw.match(/([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?/);
  if (!m) return null;
  const lat = Number.parseFloat(m[1]);
  const lon = Number.parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    ...(m[3] ? { altitude: Number.parseFloat(m[3]) } : {}),
    rawIso6709: raw.trim(),
  };
}

// ============================================================================
// Image Parsers (JPEG, PNG, WEBP)
// ============================================================================

function inspectJpeg(buf: Buffer, report: MediaMetadataReport): void {
  let pos = 2; // Skip FF D8
  while (pos + 1 < buf.length) {
    if (buf[pos] !== 0xff) {
      pos++;
      continue;
    }
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) break;
    const marker = buf[pos];
    pos++;

    if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS (scan follows)
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      continue;
    }
    if (pos + 2 > buf.length) break;
    const segLen = buf.readUInt16BE(pos);
    if (segLen < 2 || pos + segLen > buf.length) break;
    const payload = buf.subarray(pos + 2, pos + segLen);

    // SOF dimensions
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc &&
      payload.length >= 5
    ) {
      report.height = payload.readUInt16BE(1);
      report.width = payload.readUInt16BE(3);
    }

    // APP1 EXIF / XMP
    if (marker === 0xe1) {
      if (payload.subarray(0, 6).toString("ascii") === "Exif\0\0") {
        applyTiffIntoReport(payload.subarray(6), report);
      } else if (
        payload.subarray(0, 29).toString("ascii") === "http://ns.adobe.com/xap/1.0/\0"
      ) {
        parseXmpXmlIntoReport(payload.subarray(29).toString("utf8"), report);
      }
    }

    // APP11 JUMBF / C2PA
    if (marker === 0xeb) {
      const ascii = payload.subarray(0, 64).toString("ascii");
      if (ascii.includes("c2pa") || ascii.includes("jumb")) {
        report.hasC2paBox = true;
      }
    }

    // APP13 IPTC or COM Comment
    if (marker === 0xed) {
      report.iptcBytes = payload.length;
      report.textChunks.IPTC = `${payload.length} bytes`;
      report.hasPersonalMetadata = true;
      report.rawTagCount++;
    }
    if (marker === 0xfe) {
      const comment = payload.toString("utf8").replace(/\0+$/g, "").trim();
      if (comment) {
        report.textChunks.Comment = comment;
        report.hasPersonalMetadata = true;
        report.rawTagCount++;
      }
    }

    pos += segLen;
  }
}

function inspectPng(buf: Buffer, report: MediaMetadataReport): void {
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    if (pos + 12 + len > buf.length) break;
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === "IHDR" && data.length >= 8) {
      report.width = data.readUInt32BE(0);
      report.height = data.readUInt32BE(4);
    } else if (type === "eXIf") {
      applyTiffIntoReport(data, report);
    } else if (type === "tEXt") {
      const nul = data.indexOf(0);
      if (nul > 0) {
        const key = data.subarray(0, nul).toString("latin1");
        const val = data.subarray(nul + 1).toString("utf8");
        if (key === "XML:com.adobe.xmp") {
          parseXmpXmlIntoReport(val, report);
        } else {
          report.textChunks[key] = val;
          report.rawTagCount++;
          report.hasPersonalMetadata = true;
          if (/software|creator|tool/i.test(key)) {
            report.exif.editingSoftware = report.exif.editingSoftware || val;
          }
          if (/author|artist/i.test(key)) {
            report.exif.artist = report.exif.artist || val;
          }
        }
      }
    } else if (type === "zTXt") {
      const nul = data.indexOf(0);
      if (nul > 0 && nul + 2 <= data.length) {
        const key = data.subarray(0, nul).toString("latin1");
        try {
          const val = zlib.inflateSync(data.subarray(nul + 2)).toString("utf8");
          report.textChunks[key] = val;
          report.rawTagCount++;
          report.hasPersonalMetadata = true;
        } catch {
          report.textChunks[key] = "(compressed text)";
          report.rawTagCount++;
        }
      }
    } else if (type === "iTXt") {
      const nul = data.indexOf(0);
      if (nul > 0 && nul + 5 < data.length) {
        const key = data.subarray(0, nul).toString("utf8");
        const compFlag = data[nul + 1];
        const nulLang = data.indexOf(0, nul + 3);
        const nulTrans = nulLang >= 0 ? data.indexOf(0, nulLang + 1) : -1;
        if (nulTrans >= 0) {
          const textBytes = data.subarray(nulTrans + 1);
          let val = "";
          try {
            val =
              compFlag === 1
                ? zlib.inflateSync(textBytes).toString("utf8")
                : textBytes.toString("utf8");
          } catch {
            val = textBytes.toString("utf8");
          }
          if (key === "XML:com.adobe.xmp") {
            parseXmpXmlIntoReport(val, report);
          } else {
            report.textChunks[key] = val;
            report.rawTagCount++;
            report.hasPersonalMetadata = true;
          }
        }
      }
    } else if (type === "caBX") {
      report.hasC2paBox = true;
    } else if (type === "IEND") {
      break;
    }

    pos += 12 + len;
  }
}

function inspectWebp(buf: Buffer, report: MediaMetadataReport): void {
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const fourcc = buf.subarray(pos, pos + 4).toString("ascii");
    const size = buf.readUInt32LE(pos + 4);
    const dataStart = pos + 8;
    const dataEnd = Math.min(buf.length, dataStart + size);
    const data = buf.subarray(dataStart, dataEnd);

    if (fourcc === "VP8X" && data.length >= 10) {
      report.width = 1 + (data[4] | (data[5] << 8) | (data[6] << 16));
      report.height = 1 + (data[7] | (data[8] << 8) | (data[9] << 16));
    } else if (fourcc === "VP8 " && data.length >= 10 && report.width === undefined) {
      if (data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
        report.width = data.readUInt16LE(6) & 0x3fff;
        report.height = data.readUInt16LE(8) & 0x3fff;
      }
    } else if (fourcc === "VP8L" && data.length >= 5 && report.width === undefined) {
      if (data[0] === 0x2f) {
        const b0 = data.readUInt32LE(1);
        report.width = (b0 & 0x3fff) + 1;
        report.height = ((b0 >> 14) & 0x3fff) + 1;
      }
    } else if (fourcc === "EXIF") {
      const tiffSlice =
        data.subarray(0, 6).toString("ascii") === "Exif\0\0"
          ? data.subarray(6)
          : data;
      applyTiffIntoReport(tiffSlice, report);
    } else if (fourcc === "XMP ") {
      parseXmpXmlIntoReport(data.toString("utf8"), report);
    } else if (fourcc === "C2PA") {
      report.hasC2paBox = true;
    }

    pos += 8 + size + (size % 2);
  }
}

// ============================================================================
// Video Parsers (MP4 / MOV ISO BMFF & WebM EBML)
// ============================================================================

export interface IsoBox {
  type: string;
  start: number;
  headerSize: number;
  end: number;
}

export function iterateIsoBoxes(buf: Buffer, start: number, end: number): IsoBox[] {
  const boxes: IsoBox[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("latin1");
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      const big = Number(buf.readBigUInt64BE(pos + 8));
      size = big;
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) break;
    boxes.push({ type, start: pos, headerSize, end: pos + size });
    pos += size;
  }
  return boxes;
}

const MAC_EPOCH_OFFSET_SEC = 2082844800; // 1904-01-01 -> 1970-01-01

function macSecondsToIso(macSec: number): string | undefined {
  if (!Number.isFinite(macSec) || macSec <= MAC_EPOCH_OFFSET_SEC) return undefined;
  const unixMs = (macSec - MAC_EPOCH_OFFSET_SEC) * 1000;
  return new Date(unixMs).toISOString();
}

function readUdtaOrMetaText(buf: Buffer, start: number, end: number, report: MediaMetadataReport): void {
  const keysList: string[] = [];
  const boxes = iterateIsoBoxes(buf, start, end);

  for (const box of boxes) {
    const payloadStart = box.start + box.headerSize;
    if (box.type === "keys" && box.end - payloadStart >= 8) {
      let kp = payloadStart + 8;
      while (kp + 8 <= box.end) {
        const ks = buf.readUInt32BE(kp);
        if (ks < 8 || kp + ks > box.end) break;
        const val = buf.subarray(kp + 8, kp + ks).toString("utf8");
        keysList.push(val);
        kp += ks;
      }
    } else if (box.type === "ilst") {
      const items = iterateIsoBoxes(buf, payloadStart, box.end);
      for (const item of items) {
        // Key index if 1..keysList.length, else 4CC box name
        const idxRaw = buf.readUInt32BE(item.start + 4);
        const keyName =
          idxRaw >= 1 && idxRaw <= keysList.length
            ? keysList[idxRaw - 1]
            : item.type;
        const innerBoxes = iterateIsoBoxes(buf, item.start + item.headerSize, item.end);
        const dataBox = innerBoxes.find((b) => b.type === "data");
        if (dataBox && dataBox.end - (dataBox.start + dataBox.headerSize) > 8) {
          const val = buf
            .subarray(dataBox.start + dataBox.headerSize + 8, dataBox.end)
            .toString("utf8")
            .replace(/\0+$/g, "")
            .trim();
          if (val) {
            report.textChunks[keyName] = val;
            report.rawTagCount++;
            report.hasPersonalMetadata = true;
            if (/location|©xyz/i.test(keyName)) {
              const gps = parseIso6709(val);
              if (gps) {
                report.gps = gps;
                report.hasGps = true;
              }
              if (report.video) report.video.location = val;
            } else if (/too|encoder|software/i.test(keyName)) {
              report.exif.editingSoftware = report.exif.editingSoftware || val;
              if (report.video) report.video.encoder = val;
            } else if (/mak/i.test(keyName)) {
              report.exif.make = report.exif.make || val;
              report.hasCameraInfo = true;
              if (report.video) report.video.deviceMake = val;
            } else if (/mod/i.test(keyName)) {
              report.exif.model = report.exif.model || val;
              report.hasCameraInfo = true;
              if (report.video) report.video.deviceModel = val;
            }
          }
        }
      }
    } else if (box.type === "\xa9xyz") {
      const len = buf.readUInt16BE(payloadStart);
      if (payloadStart + 4 + len <= box.end) {
        const raw = buf.subarray(payloadStart + 4, payloadStart + 4 + len).toString("utf8");
        const gps = parseIso6709(raw);
        report.textChunks["©xyz"] = raw;
        report.rawTagCount++;
        report.hasPersonalMetadata = true;
        if (gps) {
          report.gps = gps;
          report.hasGps = true;
        }
        if (report.video) report.video.location = raw;
      }
    } else if (
      box.type === "\xa9too" ||
      box.type === "\xa9mak" ||
      box.type === "\xa9mod" ||
      box.type === "\xa9day" ||
      box.type === "\xa9nam"
    ) {
      let text = "";
      const sub = iterateIsoBoxes(buf, payloadStart, box.end);
      const dataSub = sub.find((b) => b.type === "data");
      if (dataSub && dataSub.end - (dataSub.start + dataSub.headerSize) > 8) {
        text = buf
          .subarray(dataSub.start + dataSub.headerSize + 8, dataSub.end)
          .toString("utf8")
          .replace(/\0+$/g, "")
          .trim();
      } else if (box.end - payloadStart >= 4) {
        const l = buf.readUInt16BE(payloadStart);
        if (payloadStart + 4 + l <= box.end) {
          text = buf.subarray(payloadStart + 4, payloadStart + 4 + l).toString("utf8");
        }
      }
      if (text) {
        report.textChunks[box.type] = text;
        report.rawTagCount++;
        report.hasPersonalMetadata = true;
        if (box.type === "\xa9too") {
          report.exif.editingSoftware = report.exif.editingSoftware || text;
          if (report.video) report.video.encoder = text;
        } else if (box.type === "\xa9mak") {
          report.exif.make = report.exif.make || text;
          report.hasCameraInfo = true;
          if (report.video) report.video.deviceMake = text;
        } else if (box.type === "\xa9mod") {
          report.exif.model = report.exif.model || text;
          report.hasCameraInfo = true;
          if (report.video) report.video.deviceModel = text;
        } else if (box.type === "\xa9day") {
          report.exif.createDate = report.exif.createDate || text;
        }
      }
    } else if (box.type === "meta") {
      // meta is either FullBox (4 zero version/flag bytes) followed by hdlr/keys/ilst, or direct container
      const next4 = buf.readUInt32BE(payloadStart);
      const nestedStart = next4 === 0 ? payloadStart + 4 : payloadStart;
      readUdtaOrMetaText(buf, nestedStart, box.end, report);
    } else if (box.type === "udta") {
      readUdtaOrMetaText(buf, payloadStart, box.end, report);
    } else if (box.type === "XMP_") {
      parseXmpXmlIntoReport(buf.subarray(payloadStart, box.end).toString("utf8"), report);
    }
  }
}

const C2PA_UUID_HEX = "d8fec3d61b0e483c92975828877ec481";

function inspectIsoBmff(buf: Buffer, report: MediaMetadataReport): void {
  const brand = buf.subarray(8, 12).toString("ascii");
  report.video = {
    container: brand === "qt  " ? "QuickTime (MOV)" : "ISO BMFF (MP4)",
  };

  const topBoxes = iterateIsoBoxes(buf, 0, buf.length);
  for (const box of topBoxes) {
    const pStart = box.start + box.headerSize;
    if (box.type === "uuid" && box.end - pStart >= 16) {
      if (buf.subarray(pStart, pStart + 16).toString("hex") === C2PA_UUID_HEX) {
        report.hasC2paBox = true;
      }
    } else if (box.type === "udta" || box.type === "meta") {
      const next4 = pStart + 4 <= box.end ? buf.readUInt32BE(pStart) : 1;
      readUdtaOrMetaText(
        buf,
        box.type === "meta" && next4 === 0 ? pStart + 4 : pStart,
        box.end,
        report
      );
    } else if (box.type === "moov") {
      const moovChildren = iterateIsoBoxes(buf, pStart, box.end);
      for (const child of moovChildren) {
        const cStart = child.start + child.headerSize;
        if (child.type === "mvhd" && child.end - cStart >= 24) {
          const version = buf[cStart];
          if (version === 0) {
            const create = buf.readUInt32BE(cStart + 4);
            const ts = buf.readUInt32BE(cStart + 12);
            const dur = buf.readUInt32BE(cStart + 16);
            if (ts > 0 && dur > 0) {
              const sec = Number((dur / ts).toFixed(2));
              report.durationSec = sec;
              report.video.durationSec = sec;
            }
            const iso = macSecondsToIso(create);
            if (iso) {
              report.video.creationTime = iso;
              report.exif.createDate = report.exif.createDate || iso;
            }
          } else if (version === 1 && child.end - cStart >= 32) {
            const create = Number(buf.readBigUInt64BE(cStart + 4));
            const ts = buf.readUInt32BE(cStart + 20);
            const dur = Number(buf.readBigUInt64BE(cStart + 24));
            if (ts > 0 && dur > 0) {
              const sec = Number((dur / ts).toFixed(2));
              report.durationSec = sec;
              report.video.durationSec = sec;
            }
            const iso = macSecondsToIso(create);
            if (iso) {
              report.video.creationTime = iso;
              report.exif.createDate = report.exif.createDate || iso;
            }
          }
        } else if (child.type === "udta" || child.type === "meta") {
          const next4 = cStart + 4 <= child.end ? buf.readUInt32BE(cStart) : 1;
          readUdtaOrMetaText(
            buf,
            child.type === "meta" && next4 === 0 ? cStart + 4 : cStart,
            child.end,
            report
          );
        } else if (child.type === "trak") {
          const trakKids = iterateIsoBoxes(buf, cStart, child.end);
          let trakWidth = 0;
          let trakHeight = 0;
          const tkhd = trakKids.find((b) => b.type === "tkhd");
          if (tkhd) {
            const tkStart = tkhd.start + tkhd.headerSize;
            const ver = buf[tkStart];
            const wOff = tkStart + (ver === 1 ? 88 : 76);
            if (wOff + 8 <= tkhd.end) {
              trakWidth = buf.readUInt32BE(wOff) >> 16;
              trakHeight = buf.readUInt32BE(wOff + 4) >> 16;
            }
          }

          const mdia = trakKids.find((b) => b.type === "mdia");
          if (mdia) {
            const mdiaKids = iterateIsoBoxes(buf, mdia.start + mdia.headerSize, mdia.end);
            const hdlr = mdiaKids.find((b) => b.type === "hdlr");
            const handlerType =
              hdlr && hdlr.end - (hdlr.start + hdlr.headerSize) >= 12
                ? buf.subarray(hdlr.start + hdlr.headerSize + 8, hdlr.start + hdlr.headerSize + 12).toString("ascii")
                : "";

            if (handlerType === "vide" || handlerType === "") {
              let mediaTimescale = 0;
              let mediaDuration = 0;
              const mdhd = mdiaKids.find((b) => b.type === "mdhd");
              if (mdhd) {
                const ms = mdhd.start + mdhd.headerSize;
                if (buf[ms] === 0 && mdhd.end - ms >= 20) {
                  mediaTimescale = buf.readUInt32BE(ms + 12);
                  mediaDuration = buf.readUInt32BE(ms + 16);
                }
              }

              const minf = mdiaKids.find((b) => b.type === "minf");
              const minfKids = minf
                ? iterateIsoBoxes(buf, minf.start + minf.headerSize, minf.end)
                : [];
              const stbl = minfKids.find((b) => b.type === "stbl");
              const stblKids = stbl
                ? iterateIsoBoxes(buf, stbl.start + stbl.headerSize, stbl.end)
                : [];

              const stsd = stblKids.find((b) => b.type === "stsd");
              if (stsd && stsd.end - (stsd.start + stsd.headerSize) >= 16) {
                const entryOff = stsd.start + stsd.headerSize + 8;
                const codec = buf.subarray(entryOff + 4, entryOff + 8).toString("ascii");
                if (
                  ["avc1", "avc3", "hvc1", "hev1", "vp09", "av01", "mp4v"].includes(codec) ||
                  handlerType === "vide"
                ) {
                  report.codec = codec;
                  report.video.codec = codec;
                  if (trakWidth > 0 && trakHeight > 0) {
                    report.width = trakWidth;
                    report.height = trakHeight;
                  } else if (entryOff + 36 <= stsd.end) {
                    report.width = buf.readUInt16BE(entryOff + 32);
                    report.height = buf.readUInt16BE(entryOff + 34);
                  }
                }
              }

              const stts = stblKids.find((b) => b.type === "stts");
              if (stts && mediaTimescale > 0 && stts.end - (stts.start + stts.headerSize) >= 16) {
                const tsOff = stts.start + stts.headerSize;
                const entryCount = buf.readUInt32BE(tsOff + 4);
                let samples = 0;
                let totalTicks = 0;
                for (let ei = 0; ei < entryCount && tsOff + 8 + (ei + 1) * 8 <= stts.end; ei++) {
                  const cnt = buf.readUInt32BE(tsOff + 8 + ei * 8);
                  const delta = buf.readUInt32BE(tsOff + 12 + ei * 8);
                  samples += cnt;
                  totalTicks += cnt * delta;
                }
                const denom = totalTicks > 0 ? totalTicks / mediaTimescale : mediaDuration / mediaTimescale;
                if (samples > 0 && denom > 0 && handlerType === "vide") {
                  const fps = (samples / denom).toFixed(2);
                  report.frameRate = fps;
                  report.video.frameRate = fps;
                }
              }
            } else if (handlerType === "soun") {
              const minf = mdiaKids.find((b) => b.type === "minf");
              const minfKids = minf
                ? iterateIsoBoxes(buf, minf.start + minf.headerSize, minf.end)
                : [];
              const stbl = minfKids.find((b) => b.type === "stbl");
              const stblKids = stbl
                ? iterateIsoBoxes(buf, stbl.start + stbl.headerSize, stbl.end)
                : [];
              const stsd = stblKids.find((b) => b.type === "stsd");
              if (stsd && stsd.end - (stsd.start + stsd.headerSize) >= 44) {
                const entryOff = stsd.start + stsd.headerSize + 8;
                const aCodec = buf
                  .subarray(entryOff + 4, entryOff + 8)
                  .toString("ascii")
                  .replace(/\0+$/g, "")
                  .trim();
                if (aCodec) {
                  report.video.audioCodec = aCodec;
                }
                if (entryOff + 36 <= stsd.end) {
                  const ch = buf.readUInt16BE(entryOff + 24);
                  const sr = buf.readUInt32BE(entryOff + 32) >>> 16;
                  if (ch > 0 && ch <= 16) report.video.audioChannels = ch;
                  if (sr >= 8000 && sr <= 384000) report.video.audioSampleRate = sr;
                }
              }
            }
          }
        }
      }
    }
  }

  if (report.durationSec && report.durationSec > 0 && report.video) {
    report.video.bitrateKbps = Math.round((buf.length * 8) / (report.durationSec * 1000));
  }
}

// ============================================================================
// WebM / EBML Minimal Parser
// ============================================================================

export interface EbmlElem {
  id: number;
  headerSize: number;
  dataSize: number;
  start: number;
  end: number;
}

function readEbmlVint(buf: Buffer, pos: number, keepLeadingBit: boolean): { value: number; length: number } | null {
  if (pos >= buf.length) return null;
  const first = buf[pos];
  if (first === 0) return null;
  let mask = 0x80;
  let len = 1;
  while (len <= 8 && (first & mask) === 0) {
    mask >>= 1;
    len++;
  }
  if (len > 8 || pos + len > buf.length) return null;
  let val = keepLeadingBit ? first : first & (mask - 1);
  for (let i = 1; i < len; i++) {
    val = val * 256 + buf[pos + i];
  }
  return { value: val, length: len };
}

export function iterateEbml(buf: Buffer, start: number, end: number): EbmlElem[] {
  const out: EbmlElem[] = [];
  let pos = start;
  while (pos < end) {
    const idRes = readEbmlVint(buf, pos, true);
    if (!idRes) break;
    const sizeRes = readEbmlVint(buf, pos + idRes.length, false);
    if (!sizeRes) break;
    const headerSize = idRes.length + sizeRes.length;
    const elemEnd = Math.min(end, pos + headerSize + sizeRes.value);
    if (elemEnd < pos + headerSize) break;
    out.push({
      id: idRes.value,
      headerSize,
      dataSize: elemEnd - (pos + headerSize),
      start: pos,
      end: elemEnd,
    });
    pos = elemEnd;
  }
  return out;
}

function inspectWebm(buf: Buffer, report: MediaMetadataReport): void {
  report.video = { container: "WebM (Matroska)" };
  const top = iterateEbml(buf, 0, buf.length);
  const segment = top.find((e) => e.id === 0x18538067);
  if (!segment) return;

  const segKids = iterateEbml(buf, segment.start + segment.headerSize, segment.end);
  for (const el of segKids) {
    const pStart = el.start + el.headerSize;
    if (el.id === 0x1549a966) {
      // Info
      let timecodeScale = 1_000_000;
      let rawDur = 0;
      for (const infoEl of iterateEbml(buf, pStart, el.end)) {
        const ip = infoEl.start + infoEl.headerSize;
        if (infoEl.id === 0x2ad7b1 && infoEl.dataSize > 0 && infoEl.dataSize <= 8) {
          let v = 0;
          for (let i = ip; i < infoEl.end; i++) v = v * 256 + buf[i];
          if (v > 0) timecodeScale = v;
        } else if (infoEl.id === 0x4489) {
          if (infoEl.dataSize === 4) rawDur = buf.readFloatBE(ip);
          else if (infoEl.dataSize === 8) rawDur = buf.readDoubleBE(ip);
        } else if (infoEl.id === 0x4d80 || infoEl.id === 0x5741) {
          const text = buf.subarray(ip, infoEl.end).toString("utf8").replace(/\0+$/g, "").trim();
          if (text) {
            const label = infoEl.id === 0x4d80 ? "MuxingApp" : "WritingApp";
            report.textChunks[label] = text;
            report.exif.editingSoftware = report.exif.editingSoftware || text;
            if (report.video) report.video.encoder = text;
            report.rawTagCount++;
            report.hasPersonalMetadata = true;
          }
        }
      }
      if (rawDur > 0) {
        const sec = Number(((rawDur * timecodeScale) / 1e9).toFixed(2));
        report.durationSec = sec;
        report.video.durationSec = sec;
      }
    } else if (el.id === 0x1654ae6b) {
      // Tracks
      for (const trk of iterateEbml(buf, pStart, el.end)) {
        if (trk.id !== 0xae) continue;
        let trackCodec = "";
        let audioChannels: number | undefined;
        let audioRate: number | undefined;
        let isAudioTrack = false;
        for (const tf of iterateEbml(buf, trk.start + trk.headerSize, trk.end)) {
          const tp = tf.start + tf.headerSize;
          if (tf.id === 0x86) {
            trackCodec = buf.subarray(tp, tf.end).toString("utf8").replace(/\0+$/g, "");
            if (trackCodec.startsWith("A_")) {
              isAudioTrack = true;
              report.video.audioCodec = trackCodec;
            } else if (trackCodec.startsWith("V_") || !report.codec) {
              report.codec = trackCodec;
              report.video.codec = trackCodec;
            }
          } else if (tf.id === 0x83 && tf.dataSize === 1 && buf[tp] === 2) {
            isAudioTrack = true;
          } else if (tf.id === 0x23e383 && tf.dataSize <= 8) {
            let ns = 0;
            for (let i = tp; i < tf.end; i++) ns = ns * 256 + buf[i];
            if (ns > 0) {
              const fps = (1e9 / ns).toFixed(2);
              report.frameRate = fps;
              report.video.frameRate = fps;
            }
          } else if (tf.id === 0xe0) {
            for (const vf of iterateEbml(buf, tp, tf.end)) {
              const vp = vf.start + vf.headerSize;
              let num = 0;
              for (let i = vp; i < vf.end; i++) num = num * 256 + buf[i];
              if (vf.id === 0xb0) report.width = num;
              if (vf.id === 0xba) report.height = num;
            }
          } else if (tf.id === 0xe1) {
            isAudioTrack = true;
            for (const af of iterateEbml(buf, tp, tf.end)) {
              const ap = af.start + af.headerSize;
              if (af.id === 0xb5) {
                if (af.dataSize === 4) audioRate = Math.round(buf.readFloatBE(ap));
                else if (af.dataSize === 8) audioRate = Math.round(buf.readDoubleBE(ap));
              } else if (af.id === 0x9f && af.dataSize >= 1 && af.dataSize <= 2) {
                audioChannels = af.dataSize === 1 ? buf[ap] : buf.readUInt16BE(ap);
              }
            }
          }
        }
        if (isAudioTrack) {
          if (trackCodec && !report.video.audioCodec) report.video.audioCodec = trackCodec;
          if (audioChannels) report.video.audioChannels = audioChannels;
          if (audioRate) report.video.audioSampleRate = audioRate;
        }
      }
    } else if (el.id === 0x1254c367) {
      // Tags
      report.hasPersonalMetadata = true;
      for (const tag of iterateEbml(buf, pStart, el.end)) {
        if (tag.id !== 0x7373) continue;
        for (const st of iterateEbml(buf, tag.start + tag.headerSize, tag.end)) {
          if (st.id !== 0x67c8) continue;
          let k = "";
          let v = "";
          for (const kv of iterateEbml(buf, st.start + st.headerSize, st.end)) {
            const kp = kv.start + kv.headerSize;
            const s = buf.subarray(kp, kv.end).toString("utf8").replace(/\0+$/g, "").trim();
            if (kv.id === 0x45a3) k = s;
            if (kv.id === 0x4487) v = s;
          }
          if (k && v) {
            report.textChunks[k] = v;
            report.rawTagCount++;
            if (/location|gps/i.test(k)) {
              const gps = parseIso6709(v);
              if (gps) report.gps = gps;
              report.hasGps = true;
            }
          }
        }
      }
    }
  }

  if (report.durationSec && report.durationSec > 0 && report.video) {
    report.video.bitrateKbps = Math.round((buf.length * 8) / (report.durationSec * 1000));
  }
}

// ============================================================================
// Public Inspection Entrypoint
// ============================================================================

export function inspectMediaMetadata(
  buf: Buffer,
  fileName: string,
  mimeType: SupportedMediaMime
): MediaMetadataReport {
  const formatLabel = mimeType.split("/")[1]?.toUpperCase() || "UNKNOWN";
  const report: MediaMetadataReport = {
    format: formatLabel === "QUICKTIME" ? "MOV" : formatLabel,
    mimeType,
    mediaKind: mimeType.startsWith("video/") ? "video" : "image",
    fileSizeBytes: buf.length,
    hasExif: false,
    hasGps: false,
    hasCameraInfo: false,
    hasPersonalMetadata: false,
    hasC2paBox: false,
    exif: { extraTags: {} },
    gps: null,
    xmp: {},
    textChunks: {},
    video: null,
    rawTagCount: 0,
  };

  try {
    if (mimeType === "image/jpeg") {
      inspectJpeg(buf, report);
    } else if (mimeType === "image/png") {
      inspectPng(buf, report);
    } else if (mimeType === "image/webp") {
      inspectWebp(buf, report);
    } else if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
      inspectIsoBmff(buf, report);
    } else if (mimeType === "video/webm") {
      inspectWebm(buf, report);
    }
  } catch {
    // Keep partial report on unusual metadata containers
  }

  return report;
}
