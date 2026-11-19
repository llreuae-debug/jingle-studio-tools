"use client";

export type InspectionStatusLabel =
  | "Verified"
  | "Detected"
  | "Not detected"
  | "Unsupported"
  | "Unable to verify"
  | "Inspection failed";

export type SupportedLocalMime =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";

export interface LocalExifSummary {
  status: InspectionStatusLabel;
  hasExif: boolean;
  hasGps: boolean;
  hasCameraInfo: boolean;
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
  gps: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    rawIso6709?: string;
  } | null;
  rawTagCount: number;
  extraTags: Record<string, string | number>;
}

export interface LocalIptcXmpSummary {
  status: InspectionStatusLabel;
  hasIptc: boolean;
  iptcBytes?: number;
  xmp: Record<string, string>;
  textChunks: Record<string, string>;
}

export interface LocalVideoInfo {
  supported: boolean;
  status: InspectionStatusLabel;
  container?: string;
  videoCodec?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  frameRate?: string;
  bitrateKbps?: number;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  encoder?: string;
  creationTime?: string;
  location?: string;
  deviceMake?: string;
  deviceModel?: string;
  containerOnlyNotice: string;
}

export interface LocalIntegrityResult {
  status: InspectionStatusLabel;
  supported: boolean;
  magicBytesValid: boolean;
  extensionMatchesHeader: boolean;
  structureValid: boolean;
  pixelDecodeValid: boolean | null;
  polyglotSafe: boolean;
  notes: string[];
}

export interface LocalMediaInspection {
  fileInfo: {
    fileName: string;
    mimeType: string;
    detectedFormat: string;
    mediaKind: "image" | "video" | "unknown";
    fileSizeBytes: number;
    sha256: string | null;
    width?: number;
    height?: number;
    durationSec?: number;
    inspectedAt: string;
  };
  integrity: LocalIntegrityResult;
  exif: LocalExifSummary;
  iptcXmp: LocalIptcXmpSummary;
  videoInfo: LocalVideoInfo;
  personalMetadata: {
    status: InspectionStatusLabel;
    hasPersonalMetadata: boolean;
    detectedFields: string[];
  };
  hasC2paBox: boolean;
}

const textDecoderUtf8 = new TextDecoder("utf-8", { fatal: false });
const textDecoderLatin1 = new TextDecoder("latin1");

function ascii(bytes: Uint8Array, start: number, end: number): string {
  const s = Math.max(0, start);
  const e = Math.min(bytes.length, end);
  let out = "";
  for (let i = s; i < e; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function getExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string | null> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // ignore if SubtleCrypto unavailable in non-secure context
  }
  return null;
}

async function inflateZlib(data: Uint8Array): Promise<string> {
  try {
    if (typeof DecompressionStream === "undefined") return "";
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([copy]).stream().pipeThrough(ds);
    const out = await new Response(stream).arrayBuffer();
    return textDecoderUtf8.decode(out);
  } catch {
    return "";
  }
}

export function detectContainerMime(bytes: Uint8Array): SupportedLocalMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "video/webm";
  }
  return null;
}

// ============================================================================
// TIFF / EXIF Parser (pure DataView)
// ============================================================================

const TIFF_TYPES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

interface TiffTagEntry {
  tag: number;
  type: number;
  raw: Uint8Array;
}

function readIfd(
  dv: DataView,
  tiff: Uint8Array,
  offset: number,
  le: boolean
): TiffTagEntry[] {
  if (offset < 8 || offset + 2 > tiff.length) return [];
  const count = dv.getUint16(offset, le);
  if (count > 256 || offset + 2 + count * 12 > tiff.length) return [];

  const out: TiffTagEntry[] = [];
  for (let i = 0; i < count; i++) {
    const eo = offset + 2 + i * 12;
    const tag = dv.getUint16(eo, le);
    const type = dv.getUint16(eo + 2, le);
    const cnt = dv.getUint32(eo + 4, le);
    const total = (TIFF_TYPES[type] || 1) * cnt;
    if (total > 1024 * 1024) continue;
    let raw: Uint8Array;
    if (total <= 4) {
      raw = tiff.subarray(eo + 8, eo + 8 + total);
    } else {
      const valOff = dv.getUint32(eo + 8, le);
      if (valOff + total > tiff.length) continue;
      raw = tiff.subarray(valOff, valOff + total);
    }
    out.push({ tag, type, raw });
  }
  return out;
}

function tiffAscii(tag: TiffTagEntry): string {
  return textDecoderUtf8.decode(tag.raw).replace(/\0+$/g, "").trim();
}

function tiffRationals(tag: TiffTagEntry, le: boolean): number[] {
  const out: number[] = [];
  const dv = new DataView(tag.raw.buffer, tag.raw.byteOffset, tag.raw.byteLength);
  const signed = tag.type === 10;
  for (let i = 0; i + 8 <= tag.raw.length; i += 8) {
    const num = signed ? dv.getInt32(i, le) : dv.getUint32(i, le);
    const den = signed ? dv.getInt32(i + 4, le) : dv.getUint32(i + 4, le);
    out.push(den === 0 ? 0 : num / den);
  }
  return out;
}

function parseTiffInto(
  tiff: Uint8Array,
  exif: LocalExifSummary,
  markPersonal: (label: string) => void
) {
  if (tiff.length < 8) return;
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return;
  const le = order === "II";
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (dv.getUint16(2, le) !== 42) return;

  exif.hasExif = true;
  const ifd0Off = dv.getUint32(4, le);
  const ifd0 = readIfd(dv, tiff, ifd0Off, le);

  let exifIfd: TiffTagEntry[] = [];
  let gpsIfd: TiffTagEntry[] = [];

  for (const t of ifd0) {
    if (t.tag === 0x8769 && t.raw.length >= 4) {
      const pDv = new DataView(t.raw.buffer, t.raw.byteOffset, t.raw.byteLength);
      exifIfd = readIfd(dv, tiff, pDv.getUint32(0, le), le);
      continue;
    }
    if (t.tag === 0x8825 && t.raw.length >= 4) {
      const pDv = new DataView(t.raw.buffer, t.raw.byteOffset, t.raw.byteLength);
      gpsIfd = readIfd(dv, tiff, pDv.getUint32(0, le), le);
      continue;
    }

    exif.rawTagCount++;
    if (t.tag === 0x010f) {
      const v = tiffAscii(t);
      if (v) {
        exif.make = v;
        exif.hasCameraInfo = true;
        markPersonal("Camera make");
      }
    } else if (t.tag === 0x0110) {
      const v = tiffAscii(t);
      if (v) {
        exif.model = v;
        exif.hasCameraInfo = true;
        markPersonal("Camera model");
      }
    } else if (t.tag === 0x0112 && t.raw.length >= 2) {
      const oDv = new DataView(t.raw.buffer, t.raw.byteOffset, t.raw.byteLength);
      exif.orientation = oDv.getUint16(0, le);
    } else if (t.tag === 0x0131) {
      const v = tiffAscii(t);
      if (v) {
        exif.software = v;
        exif.editingSoftware = exif.editingSoftware || v;
        markPersonal("Software / Editing tool");
      }
    } else if (t.tag === 0x0132) {
      const v = tiffAscii(t);
      if (v) {
        exif.createDate = exif.createDate || v;
        markPersonal("Creation timestamp");
      }
    } else if (t.tag === 0x013b) {
      const v = tiffAscii(t);
      if (v) {
        exif.artist = v;
        markPersonal("Creator / Artist");
      }
    } else if (t.tag === 0x8298) {
      const v = tiffAscii(t);
      if (v) {
        exif.copyright = v;
        markPersonal("Copyright");
      }
    } else if (t.type === 2) {
      const v = tiffAscii(t);
      if (v) exif.extraTags[`0x${t.tag.toString(16)}`] = v;
    }
  }

  for (const t of exifIfd) {
    exif.rawTagCount++;
    if (t.tag === 0x9003) {
      const v = tiffAscii(t);
      if (v) {
        exif.dateTimeOriginal = v;
        markPersonal("Capture timestamp");
      }
    } else if (t.tag === 0x9004) {
      const v = tiffAscii(t);
      if (v) exif.createDate = v;
    } else if (t.tag === 0xa433 || t.tag === 0xa434) {
      const v = tiffAscii(t);
      if (v) {
        exif.lensModel = exif.lensModel ? `${exif.lensModel} ${v}` : v;
        exif.hasCameraInfo = true;
        markPersonal("Lens information");
      }
    } else if (t.tag === 0xa431 || t.tag === 0xa435) {
      const v = tiffAscii(t);
      if (v) {
        exif.extraTags[`serial_${t.tag.toString(16)}`] = v;
        exif.hasCameraInfo = true;
        markPersonal("Device / Camera serial");
      }
    } else if (t.tag === 0x9286) {
      const slice = t.raw.length > 8 ? t.raw.subarray(8) : t.raw;
      const v = textDecoderUtf8.decode(slice).replace(/\0+$/g, "").trim();
      if (v) {
        exif.extraTags.UserComment = v;
        markPersonal("EXIF UserComment");
      }
    }
  }

  if (gpsIfd.length > 0) {
    let latRef = "N";
    let lonRef = "E";
    let latArr: number[] | null = null;
    let lonArr: number[] | null = null;
    let altRef = 0;
    let altVal: number | undefined;

    for (const t of gpsIfd) {
      exif.rawTagCount++;
      if (t.tag === 0x0001) latRef = tiffAscii(t) || "N";
      if (t.tag === 0x0002) latArr = tiffRationals(t, le);
      if (t.tag === 0x0003) lonRef = tiffAscii(t) || "E";
      if (t.tag === 0x0004) lonArr = tiffRationals(t, le);
      if (t.tag === 0x0005 && t.raw.length >= 1) altRef = t.raw[0];
      if (t.tag === 0x0006) {
        const nums = tiffRationals(t, le);
        if (nums.length > 0) altVal = nums[0];
      }
    }

    const toDec = (dms: number[] | null, ref: string): number | undefined => {
      if (!dms || dms.length === 0) return undefined;
      const val = (dms[0] || 0) + (dms[1] || 0) / 60 + (dms[2] || 0) / 3600;
      const sign = ref.toUpperCase() === "S" || ref.toUpperCase() === "W" ? -1 : 1;
      return Number((val * sign).toFixed(6));
    };

    const lat = toDec(latArr, latRef);
    const lon = toDec(lonArr, lonRef);
    if (lat !== undefined || lon !== undefined || altVal !== undefined) {
      exif.hasGps = true;
      exif.gps = {
        ...(lat !== undefined ? { latitude: lat } : {}),
        ...(lon !== undefined ? { longitude: lon } : {}),
        ...(altVal !== undefined
          ? { altitude: Number((altRef === 1 ? -altVal : altVal).toFixed(2)) }
          : {}),
      };
      markPersonal("GPS coordinates");
    }
  }
}

function parseXmpInto(
  xml: string,
  iptcXmp: LocalIptcXmpSummary,
  exif: LocalExifSummary,
  markPersonal: (label: string) => void
) {
  const rxMap: Array<[string, RegExp]> = [
    ["CreatorTool", /<(?:xmp:)?CreatorTool[^>]*>([^<]+)<\/(?:xmp:)?CreatorTool>/i],
    ["CreateDate", /<(?:xmp:)?CreateDate[^>]*>([^<]+)<\/(?:xmp:)?CreateDate>/i],
    ["SoftwareAgent", /<(?:stEvt:)?softwareAgent[^>]*>([^<]+)<\/(?:stEvt:)?softwareAgent>/i],
    ["Creator", /<(?:dc:)?creator[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/i],
    ["GPSLatitude", /<(?:exif:)?GPSLatitude[^>]*>([^<]+)<\/(?:exif:)?GPSLatitude>/i],
    ["GPSLongitude", /<(?:exif:)?GPSLongitude[^>]*>([^<]+)<\/(?:exif:)?GPSLongitude>/i],
    ["Make", /<(?:tiff:)?Make[^>]*>([^<]+)<\/(?:tiff:)?Make>/i],
    ["Model", /<(?:tiff:)?Model[^>]*>([^<]+)<\/(?:tiff:)?Model>/i],
  ];

  for (const [k, rx] of rxMap) {
    const m = xml.match(rx);
    if (m?.[1]?.trim()) {
      const v = m[1].trim();
      iptcXmp.xmp[k] = v;
      exif.rawTagCount++;
      markPersonal("XMP metadata block");
      if (k === "CreatorTool" || k === "SoftwareAgent") {
        exif.editingSoftware = exif.editingSoftware || v;
      } else if (k === "CreateDate") {
        exif.createDate = exif.createDate || v;
      } else if (k === "Make") {
        exif.make = exif.make || v;
        exif.hasCameraInfo = true;
      } else if (k === "Model") {
        exif.model = exif.model || v;
        exif.hasCameraInfo = true;
      } else if (k === "GPSLatitude" || k === "GPSLongitude") {
        exif.hasGps = true;
        markPersonal("GPS coordinates");
      }
    }
  }
}

function parseIso6709(raw: string) {
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
// Pure Buffer Inspector (Works in both Browser & Vitest/Node)
// ============================================================================

export async function inspectBufferMetadata(
  bytes: Uint8Array,
  fileName: string,
  declaredMime?: string
): Promise<LocalMediaInspection> {
  const inspectedAt = new Date().toISOString();
  const ext = getExt(fileName);
  const sha256 = await computeSha256Hex(bytes);

  const emptyResult = (
    status: InspectionStatusLabel,
    supported: boolean,
    note: string,
    polyglotSafe = true
  ): LocalMediaInspection => ({
    fileInfo: {
      fileName,
      mimeType: declaredMime || "application/octet-stream",
      detectedFormat: ext ? ext.slice(1).toUpperCase() : "UNKNOWN",
      mediaKind: "unknown",
      fileSizeBytes: bytes.length,
      sha256,
      inspectedAt,
    },
    integrity: {
      status,
      supported,
      magicBytesValid: false,
      extensionMatchesHeader: false,
      structureValid: false,
      pixelDecodeValid: null,
      polyglotSafe,
      notes: [note],
    },
    exif: {
      status: supported ? "Not detected" : status,
      hasExif: false,
      hasGps: false,
      hasCameraInfo: false,
      gps: null,
      rawTagCount: 0,
      extraTags: {},
    },
    iptcXmp: {
      status: supported ? "Not detected" : status,
      hasIptc: false,
      xmp: {},
      textChunks: {},
    },
    videoInfo: {
      supported: false,
      status: "Not detected",
      containerOnlyNotice:
        "Video analysis inspects container headers, streams, and metadata only.",
    },
    personalMetadata: {
      status: supported ? "Not detected" : status,
      hasPersonalMetadata: false,
      detectedFields: [],
    },
    hasC2paBox: false,
  });

  if (bytes.length === 0) {
    return emptyResult(
      "Inspection failed",
      false,
      "File is empty (0 bytes) and cannot be inspected."
    );
  }

  const head = textDecoderUtf8
    .decode(bytes.subarray(0, Math.min(bytes.length, 512)))
    .trimStart()
    .toLowerCase();
  if (
    head.startsWith("<html") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<script") ||
    head.startsWith("<svg") ||
    head.includes("<script")
  ) {
    return emptyResult(
      "Inspection failed",
      false,
      "Unsafe HTML, SVG, or script payload rejected before parsing.",
      false
    );
  }

  const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".webm"]);
  if (ext && !allowedExt.has(ext)) {
    return emptyResult(
      "Unsupported",
      false,
      `Unsupported file format "${ext}". Supported formats: PNG, JPG/JPEG, WebP, MP4, MOV, WebM.`
    );
  }

  if (bytes.length < 12) {
    return emptyResult(
      "Inspection failed",
      false,
      "File is truncated (< 12 bytes) and has no valid media container header."
    );
  }

  const realMime = detectContainerMime(bytes);
  if (!realMime) {
    const label = ext ? ext.slice(1).toUpperCase() : "binary";
    return emptyResult(
      ext && allowedExt.has(ext) ? "Inspection failed" : "Unsupported",
      false,
      `File header does not match a valid PNG, JPEG, WebP, MP4, MOV, or WebM container (${label}).`
    );
  }

  const mediaKind: "image" | "video" = realMime.startsWith("video/") ? "video" : "image";
  const formatLabel =
    realMime === "video/quicktime"
      ? "MOV"
      : realMime.split("/")[1]?.toUpperCase() || "UNKNOWN";

  const extMatch =
    !ext ||
    (ext === ".png" && realMime === "image/png") ||
    ((ext === ".jpg" || ext === ".jpeg") && realMime === "image/jpeg") ||
    (ext === ".webp" && realMime === "image/webp") ||
    (ext === ".webm" && realMime === "video/webm") ||
    ((ext === ".mp4" || ext === ".mov") &&
      (realMime === "video/mp4" || realMime === "video/quicktime"));

  const notes: string[] = [];
  if (!extMatch) {
    notes.push(`File extension "${ext}" does not match actual ${realMime} signature.`);
  }

  const personalSet = new Set<string>();
  const markPersonal = (label: string) => personalSet.add(label);

  const exif: LocalExifSummary = {
    status: "Not detected",
    hasExif: false,
    hasGps: false,
    hasCameraInfo: false,
    gps: null,
    rawTagCount: 0,
    extraTags: {},
  };

  const iptcXmp: LocalIptcXmpSummary = {
    status: "Not detected",
    hasIptc: false,
    xmp: {},
    textChunks: {},
  };

  const videoInfo: LocalVideoInfo = {
    supported: mediaKind === "video",
    status: mediaKind === "video" ? "Detected" : "Not detected",
    containerOnlyNotice:
      "Video analysis inspects container headers, streams, and metadata only — it does not decode every video frame.",
  };

  let width: number | undefined;
  let height: number | undefined;
  let durationSec: number | undefined;
  let hasC2paBox = false;
  let structureValid = false;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (realMime === "image/png") {
    let pos = 8;
    let sawIhdr = false;
    let sawIdat = false;
    let sawIend = false;
    let truncated = false;

    while (pos + 12 <= bytes.length) {
      const len = dv.getUint32(pos, false);
      const type = ascii(bytes, pos + 4, pos + 8);
      if (pos + 12 + len > bytes.length) {
        truncated = true;
        break;
      }
      const data = bytes.subarray(pos + 8, pos + 8 + len);

      if (type === "IHDR" && data.length >= 8) {
        sawIhdr = true;
        const w = dv.getUint32(pos + 8, false);
        const h = dv.getUint32(pos + 12, false);
        if (w > 0 && h > 0) {
          width = w;
          height = h;
        }
      } else if (type === "IDAT") {
        sawIdat = true;
      } else if (type === "eXIf") {
        parseTiffInto(data, exif, markPersonal);
      } else if (type === "tEXt") {
        const nul = data.indexOf(0);
        if (nul > 0) {
          const key = textDecoderLatin1.decode(data.subarray(0, nul));
          const val = textDecoderUtf8.decode(data.subarray(nul + 1));
          if (key === "XML:com.adobe.xmp") {
            parseXmpInto(val, iptcXmp, exif, markPersonal);
          } else {
            iptcXmp.textChunks[key] = val;
            exif.rawTagCount++;
            markPersonal(`Embedded tag: ${key}`);
          }
        }
      } else if (type === "zTXt") {
        const nul = data.indexOf(0);
        if (nul > 0 && nul + 2 <= data.length) {
          const key = textDecoderLatin1.decode(data.subarray(0, nul));
          const val = await inflateZlib(data.subarray(nul + 2));
          iptcXmp.textChunks[key] = val || "(compressed text)";
          exif.rawTagCount++;
          markPersonal(`Embedded tag: ${key}`);
        }
      } else if (type === "iTXt") {
        const nul = data.indexOf(0);
        if (nul > 0 && nul + 5 < data.length) {
          const key = textDecoderUtf8.decode(data.subarray(0, nul));
          const compFlag = data[nul + 1];
          const nulLang = data.indexOf(0, nul + 3);
          const nulTrans = nulLang >= 0 ? data.indexOf(0, nulLang + 1) : -1;
          if (nulTrans >= 0) {
            const rawText = data.subarray(nulTrans + 1);
            const val =
              compFlag === 1
                ? await inflateZlib(rawText)
                : textDecoderUtf8.decode(rawText);
            if (key === "XML:com.adobe.xmp" && val) {
              parseXmpInto(val, iptcXmp, exif, markPersonal);
            } else {
              iptcXmp.textChunks[key] = val || "(international text)";
              exif.rawTagCount++;
              markPersonal(`Embedded tag: ${key}`);
            }
          }
        }
      } else if (type === "caBX") {
        hasC2paBox = true;
      } else if (type === "IEND") {
        sawIend = true;
        pos += 12 + len;
        break;
      }
      pos += 12 + len;
    }

    structureValid = sawIhdr && sawIdat && sawIend && !truncated;
    if (!structureValid) {
      notes.push("PNG structure incomplete or truncated (missing valid IHDR/IDAT/IEND chunks).");
    }
  } else if (realMime === "image/jpeg") {
    let pos = 2;
    let sawSos = false;
    let truncated = false;

    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xff) {
        pos++;
        continue;
      }
      while (pos < bytes.length && bytes[pos] === 0xff) pos++;
      if (pos >= bytes.length) {
        truncated = true;
        break;
      }
      const marker = bytes[pos++];
      if (marker === 0xda) {
        sawSos = true;
        break;
      }
      if (marker === 0xd9) break;
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        continue;
      }
      if (pos + 2 > bytes.length) {
        truncated = true;
        break;
      }
      const segLen = dv.getUint16(pos, false);
      if (segLen < 2 || pos + segLen > bytes.length) {
        truncated = true;
        break;
      }
      const payload = bytes.subarray(pos + 2, pos + segLen);

      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc &&
        payload.length >= 5
      ) {
        const pDv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        height = pDv.getUint16(1, false);
        width = pDv.getUint16(3, false);
      } else if (marker === 0xe1) {
        if (ascii(payload, 0, 6) === "Exif\0\0") {
          parseTiffInto(payload.subarray(6), exif, markPersonal);
        } else if (ascii(payload, 0, 29) === "http://ns.adobe.com/xap/1.0/\0") {
          parseXmpInto(
            textDecoderUtf8.decode(payload.subarray(29)),
            iptcXmp,
            exif,
            markPersonal
          );
        }
      } else if (marker === 0xeb) {
        const sample = ascii(payload, 0, Math.min(payload.length, 64));
        if (sample.includes("c2pa") || sample.includes("jumb")) {
          hasC2paBox = true;
        }
      } else if (marker === 0xed) {
        iptcXmp.hasIptc = true;
        iptcXmp.iptcBytes = payload.length;
        iptcXmp.textChunks.IPTC = `${payload.length} bytes`;
        exif.rawTagCount++;
        markPersonal("IPTC metadata");
      } else if (marker === 0xfe) {
        const comment = textDecoderUtf8.decode(payload).replace(/\0+$/g, "").trim();
        if (comment) {
          iptcXmp.textChunks.Comment = comment;
          exif.rawTagCount++;
          markPersonal("JPEG comment");
        }
      }
      pos += segLen;
    }

    structureValid = sawSos && !truncated;
    if (!structureValid) {
      notes.push("JPEG bitstream is truncated or missing Start-of-Scan (SOS) marker.");
    }
  } else if (realMime === "image/webp") {
    const declaredRiffEnd = 8 + dv.getUint32(4, true);
    let pos = 12;
    let sawFrame = false;
    let badChunk = declaredRiffEnd > bytes.length + 1;

    while (pos + 8 <= bytes.length) {
      const fourcc = ascii(bytes, pos, pos + 4);
      const size = dv.getUint32(pos + 4, true);
      if (pos + 8 + size > bytes.length) {
        badChunk = true;
        break;
      }
      const data = bytes.subarray(pos + 8, pos + 8 + size);
      if (fourcc === "VP8X" && data.length >= 10) {
        width = 1 + (data[4] | (data[5] << 8) | (data[6] << 16));
        height = 1 + (data[7] | (data[8] << 8) | (data[9] << 16));
      } else if (fourcc === "VP8 " && data.length >= 10) {
        if (data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
          sawFrame = true;
          if (width === undefined) {
            const pDv = new DataView(data.buffer, data.byteOffset, data.byteLength);
            width = pDv.getUint16(6, true) & 0x3fff;
            height = pDv.getUint16(8, true) & 0x3fff;
          }
        }
      } else if (fourcc === "VP8L" && data.length >= 5) {
        if (data[0] === 0x2f) {
          sawFrame = true;
          if (width === undefined) {
            const pDv = new DataView(data.buffer, data.byteOffset, data.byteLength);
            const b0 = pDv.getUint32(1, true);
            width = (b0 & 0x3fff) + 1;
            height = ((b0 >> 14) & 0x3fff) + 1;
          }
        }
      } else if (fourcc === "EXIF") {
        const slice = ascii(data, 0, 6) === "Exif\0\0" ? data.subarray(6) : data;
        parseTiffInto(slice, exif, markPersonal);
      } else if (fourcc === "XMP ") {
        parseXmpInto(textDecoderUtf8.decode(data), iptcXmp, exif, markPersonal);
      } else if (fourcc === "C2PA") {
        hasC2paBox = true;
      }
      pos += 8 + size + (size % 2);
    }

    structureValid = sawFrame && !badChunk && (width ?? 0) > 0 && (height ?? 0) > 0;
    if (!structureValid) {
      notes.push("WebP container missing valid VP8/VP8L frame or truncated chunk.");
    }
  } else if (realMime === "video/mp4" || realMime === "video/quicktime") {
    const brand = ascii(bytes, 8, 12);
    videoInfo.container = brand === "qt  " ? "QuickTime (MOV)" : "ISO BMFF (MP4)";

    const iterBoxes = (start: number, end: number) => {
      const list: Array<{ type: string; start: number; header: number; end: number }> = [];
      let p = start;
      while (p + 8 <= end) {
        let size = dv.getUint32(p, false);
        const type = ascii(bytes, p + 4, p + 8);
        let header = 8;
        if (size === 1) {
          if (p + 16 > end) break;
          size = Number(dv.getBigUint64(p + 8, false));
          header = 16;
        } else if (size === 0) {
          size = end - p;
        }
        if (size < header || p + size > end) break;
        list.push({ type, start: p, header, end: p + size });
        p += size;
      }
      return list;
    };

    const readMetaStrings = (start: number, end: number) => {
      for (const box of iterBoxes(start, end)) {
        const pStart = box.start + box.header;
        if (box.type === "\xa9xyz" && pStart + 4 <= box.end) {
          const l = dv.getUint16(pStart, false);
          if (pStart + 4 + l <= box.end) {
            const raw = textDecoderUtf8.decode(bytes.subarray(pStart + 4, pStart + 4 + l));
            iptcXmp.textChunks["©xyz"] = raw;
            exif.rawTagCount++;
            videoInfo.location = raw;
            const gps = parseIso6709(raw);
            if (gps) {
              exif.gps = gps;
              exif.hasGps = true;
            }
            markPersonal("GPS coordinates");
          }
        } else if (
          ["\xa9too", "\xa9mak", "\xa9mod", "\xa9day", "\xa9nam"].includes(box.type) &&
          pStart + 4 <= box.end
        ) {
          const l = dv.getUint16(pStart, false);
          const raw =
            pStart + 4 + l <= box.end
              ? textDecoderUtf8.decode(bytes.subarray(pStart + 4, pStart + 4 + l)).trim()
              : "";
          if (raw) {
            iptcXmp.textChunks[box.type] = raw;
            exif.rawTagCount++;
            if (box.type === "\xa9too") {
              videoInfo.encoder = raw;
              exif.editingSoftware = raw;
              markPersonal("Video encoder / tool");
            } else if (box.type === "\xa9mak") {
              videoInfo.deviceMake = raw;
              exif.make = raw;
              exif.hasCameraInfo = true;
              markPersonal("Camera make");
            } else if (box.type === "\xa9mod") {
              videoInfo.deviceModel = raw;
              exif.model = raw;
              exif.hasCameraInfo = true;
              markPersonal("Camera model");
            } else if (box.type === "\xa9day") {
              exif.createDate = raw;
              markPersonal("Creation timestamp");
            }
          }
        } else if (box.type === "meta" && pStart + 4 <= box.end) {
          const next4 = dv.getUint32(pStart, false);
          readMetaStrings(next4 === 0 ? pStart + 4 : pStart, box.end);
        } else if (box.type === "udta") {
          readMetaStrings(pStart, box.end);
        } else if (box.type === "XMP_") {
          parseXmpInto(
            textDecoderUtf8.decode(bytes.subarray(pStart, box.end)),
            iptcXmp,
            exif,
            markPersonal
          );
        }
      }
    };

    const top = iterBoxes(0, bytes.length);
    let sawMoov = false;
    for (const box of top) {
      const pStart = box.start + box.header;
      if (box.type === "uuid" && box.end - pStart >= 16) {
        const hex = Array.from(bytes.subarray(pStart, pStart + 16))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (hex === "d8fec3d61b0e483c92975828877ec481") hasC2paBox = true;
      } else if (box.type === "udta" || box.type === "meta") {
        const next4 = pStart + 4 <= box.end ? dv.getUint32(pStart, false) : 1;
        readMetaStrings(box.type === "meta" && next4 === 0 ? pStart + 4 : pStart, box.end);
      } else if (box.type === "moov") {
        sawMoov = true;
        for (const child of iterBoxes(pStart, box.end)) {
          const cStart = child.start + child.header;
          if (child.type === "mvhd" && child.end - cStart >= 24 && bytes[cStart] === 0) {
            const create = dv.getUint32(cStart + 4, false);
            const ts = dv.getUint32(cStart + 12, false);
            const dur = dv.getUint32(cStart + 16, false);
            if (ts > 0 && dur > 0) {
              durationSec = Number((dur / ts).toFixed(2));
              videoInfo.durationSec = durationSec;
            }
            if (create > 2082844800) {
              videoInfo.creationTime = new Date((create - 2082844800) * 1000).toISOString();
              exif.createDate = exif.createDate || videoInfo.creationTime;
            }
          } else if (child.type === "udta" || child.type === "meta") {
            const next4 = cStart + 4 <= child.end ? dv.getUint32(cStart, false) : 1;
            readMetaStrings(child.type === "meta" && next4 === 0 ? cStart + 4 : cStart, child.end);
          } else if (child.type === "trak") {
            const trakKids = iterBoxes(cStart, child.end);
            let tw = 0;
            let th = 0;
            const tkhd = trakKids.find((b) => b.type === "tkhd");
            if (tkhd) {
              const tkStart = tkhd.start + tkhd.header;
              const wOff = tkStart + (bytes[tkStart] === 1 ? 88 : 76);
              if (wOff + 8 <= tkhd.end) {
                tw = dv.getUint32(wOff, false) >> 16;
                th = dv.getUint32(wOff + 4, false) >> 16;
              }
            }
            const mdia = trakKids.find((b) => b.type === "mdia");
            if (mdia) {
              const mKids = iterBoxes(mdia.start + mdia.header, mdia.end);
              const hdlr = mKids.find((b) => b.type === "hdlr");
              const hType =
                hdlr && hdlr.end - (hdlr.start + hdlr.header) >= 12
                  ? ascii(bytes, hdlr.start + hdlr.header + 8, hdlr.start + hdlr.header + 12)
                  : "";
              const mdhd = mKids.find((b) => b.type === "mdhd");
              let timescale = 0;
              if (mdhd && bytes[mdhd.start + mdhd.header] === 0 && mdhd.end - (mdhd.start + mdhd.header) >= 20) {
                timescale = dv.getUint32(mdhd.start + mdhd.header + 12, false);
              }
              const minf = mKids.find((b) => b.type === "minf");
              const stbl = minf
                ? iterBoxes(minf.start + minf.header, minf.end).find((b) => b.type === "stbl")
                : undefined;
              const stblKids = stbl ? iterBoxes(stbl.start + stbl.header, stbl.end) : [];
              const stsd = stblKids.find((b) => b.type === "stsd");

              if (hType === "vide" || hType === "") {
                if (stsd && stsd.end - (stsd.start + stsd.header) >= 16) {
                  const eOff = stsd.start + stsd.header + 8;
                  const codec = ascii(bytes, eOff + 4, eOff + 8);
                  videoInfo.videoCodec = codec;
                  width = tw || (eOff + 36 <= stsd.end ? dv.getUint16(eOff + 32, false) : undefined);
                  height = th || (eOff + 36 <= stsd.end ? dv.getUint16(eOff + 34, false) : undefined);
                  videoInfo.width = width;
                  videoInfo.height = height;
                }
                const stts = stblKids.find((b) => b.type === "stts");
                if (stts && timescale > 0 && stts.end - (stts.start + stts.header) >= 16) {
                  const tsOff = stts.start + stts.header;
                  const count = dv.getUint32(tsOff + 4, false);
                  let samples = 0;
                  let ticks = 0;
                  for (let i = 0; i < count && tsOff + 8 + (i + 1) * 8 <= stts.end; i++) {
                    const cnt = dv.getUint32(tsOff + 8 + i * 8, false);
                    const delta = dv.getUint32(tsOff + 12 + i * 8, false);
                    samples += cnt;
                    ticks += cnt * delta;
                  }
                  if (samples > 0 && ticks > 0 && hType === "vide") {
                    videoInfo.frameRate = (samples / (ticks / timescale)).toFixed(2);
                  }
                }
              } else if (hType === "soun" && stsd && stsd.end - (stsd.start + stsd.header) >= 44) {
                const eOff = stsd.start + stsd.header + 8;
                videoInfo.audioCodec = ascii(bytes, eOff + 4, eOff + 8).trim() || undefined;
                if (eOff + 36 <= stsd.end) {
                  const ch = dv.getUint16(eOff + 24, false);
                  const sr = dv.getUint32(eOff + 32, false) >>> 16;
                  if (ch > 0 && ch <= 16) videoInfo.audioChannels = ch;
                  if (sr >= 8000 && sr <= 384000) videoInfo.audioSampleRate = sr;
                }
              }
            }
          }
        }
      }
    }

    if (durationSec && durationSec > 0) {
      videoInfo.bitrateKbps = Math.round((bytes.length * 8) / (durationSec * 1000));
    }
    structureValid = sawMoov;
    if (!structureValid) {
      notes.push("ISO BMFF container missing moov atom.");
    }
  } else if (realMime === "video/webm") {
    videoInfo.container = "WebM (Matroska)";
    const readVint = (pos: number, keep: boolean) => {
      if (pos >= bytes.length || bytes[pos] === 0) return null;
      let mask = 0x80;
      let len = 1;
      while (len <= 8 && (bytes[pos] & mask) === 0) {
        mask >>= 1;
        len++;
      }
      if (len > 8 || pos + len > bytes.length) return null;
      let v = keep ? bytes[pos] : bytes[pos] & (mask - 1);
      for (let i = 1; i < len; i++) v = v * 256 + bytes[pos + i];
      return { value: v, length: len };
    };
    const iterEbml = (start: number, end: number) => {
      const list: Array<{ id: number; header: number; size: number; start: number; end: number }> = [];
      let p = start;
      while (p < end) {
        const idR = readVint(p, true);
        if (!idR) break;
        const szR = readVint(p + idR.length, false);
        if (!szR) break;
        const header = idR.length + szR.length;
        const elEnd = Math.min(end, p + header + szR.value);
        if (elEnd < p + header) break;
        list.push({ id: idR.value, header, size: elEnd - (p + header), start: p, end: elEnd });
        p = elEnd;
      }
      return list;
    };

    const top = iterEbml(0, bytes.length);
    const segment = top.find((e) => e.id === 0x18538067);
    if (segment) {
      structureValid = true;
      for (const el of iterEbml(segment.start + segment.header, segment.end)) {
        const pStart = el.start + el.header;
        if (el.id === 0x1549a966) {
          let tcScale = 1_000_000;
          let rawDur = 0;
          for (const infoEl of iterEbml(pStart, el.end)) {
            const ip = infoEl.start + infoEl.header;
            if (infoEl.id === 0x2ad7b1 && infoEl.size > 0 && infoEl.size <= 8) {
              let v = 0;
              for (let i = ip; i < infoEl.end; i++) v = v * 256 + bytes[i];
              if (v > 0) tcScale = v;
            } else if (infoEl.id === 0x4489) {
              if (infoEl.size === 4) rawDur = dv.getFloat32(ip, false);
              else if (infoEl.size === 8) rawDur = dv.getFloat64(ip, false);
            } else if (infoEl.id === 0x4d80 || infoEl.id === 0x5741) {
              const s = textDecoderUtf8.decode(bytes.subarray(ip, infoEl.end)).replace(/\0+$/g, "").trim();
              if (s) {
                const k = infoEl.id === 0x4d80 ? "MuxingApp" : "WritingApp";
                iptcXmp.textChunks[k] = s;
                videoInfo.encoder = s;
                exif.editingSoftware = exif.editingSoftware || s;
                exif.rawTagCount++;
                markPersonal(`Embedded tag: ${k}`);
              }
            }
          }
          if (rawDur > 0) {
            durationSec = Number(((rawDur * tcScale) / 1e9).toFixed(2));
            videoInfo.durationSec = durationSec;
          }
        } else if (el.id === 0x1654ae6b) {
          for (const trk of iterEbml(pStart, el.end)) {
            if (trk.id !== 0xae) continue;
            let tCodec = "";
            let isAudio = false;
            let aCh: number | undefined;
            let aSr: number | undefined;
            for (const tf of iterEbml(trk.start + trk.header, trk.end)) {
              const tp = tf.start + tf.header;
              if (tf.id === 0x86) {
                tCodec = textDecoderUtf8.decode(bytes.subarray(tp, tf.end)).replace(/\0+$/g, "");
                if (tCodec.startsWith("A_")) {
                  isAudio = true;
                  videoInfo.audioCodec = tCodec;
                } else if (tCodec.startsWith("V_") || !videoInfo.videoCodec) {
                  videoInfo.videoCodec = tCodec;
                }
              } else if (tf.id === 0x83 && tf.size === 1 && bytes[tp] === 2) {
                isAudio = true;
              } else if (tf.id === 0x23e383 && tf.size <= 8) {
                let ns = 0;
                for (let i = tp; i < tf.end; i++) ns = ns * 256 + bytes[i];
                if (ns > 0) videoInfo.frameRate = (1e9 / ns).toFixed(2);
              } else if (tf.id === 0xe0) {
                for (const vf of iterEbml(tp, tf.end)) {
                  const vp = vf.start + vf.header;
                  let num = 0;
                  for (let i = vp; i < vf.end; i++) num = num * 256 + bytes[i];
                  if (vf.id === 0xb0) {
                    width = num;
                    videoInfo.width = num;
                  }
                  if (vf.id === 0xba) {
                    height = num;
                    videoInfo.height = num;
                  }
                }
              } else if (tf.id === 0xe1) {
                isAudio = true;
                for (const af of iterEbml(tp, tf.end)) {
                  const ap = af.start + af.header;
                  if (af.id === 0xb5) {
                    if (af.size === 4) aSr = Math.round(dv.getFloat32(ap, false));
                    else if (af.size === 8) aSr = Math.round(dv.getFloat64(ap, false));
                  } else if (af.id === 0x9f && af.size >= 1 && af.size <= 2) {
                    aCh = af.size === 1 ? bytes[ap] : dv.getUint16(ap, false);
                  }
                }
              }
            }
            if (isAudio) {
              if (tCodec && !videoInfo.audioCodec) videoInfo.audioCodec = tCodec;
              if (aCh) videoInfo.audioChannels = aCh;
              if (aSr) videoInfo.audioSampleRate = aSr;
            }
          }
        } else if (el.id === 0x1254c367) {
          for (const tag of iterEbml(pStart, el.end)) {
            if (tag.id !== 0x7373) continue;
            for (const st of iterEbml(tag.start + tag.header, tag.end)) {
              if (st.id !== 0x67c8) continue;
              let k = "";
              let v = "";
              for (const kv of iterEbml(st.start + st.header, st.end)) {
                const kp = kv.start + kv.header;
                const s = textDecoderUtf8.decode(bytes.subarray(kp, kv.end)).replace(/\0+$/g, "").trim();
                if (kv.id === 0x45a3) k = s;
                if (kv.id === 0x4487) v = s;
              }
              if (k && v) {
                iptcXmp.textChunks[k] = v;
                exif.rawTagCount++;
                markPersonal(`Embedded tag: ${k}`);
                if (/location|gps/i.test(k)) {
                  exif.hasGps = true;
                  const gps = parseIso6709(v);
                  if (gps) exif.gps = gps;
                  markPersonal("GPS coordinates");
                }
              }
            }
          }
        }
      }
      if (durationSec && durationSec > 0) {
        videoInfo.bitrateKbps = Math.round((bytes.length * 8) / (durationSec * 1000));
      }
    } else {
      notes.push("WebM container missing EBML Segment element.");
    }
  }

  exif.status = exif.hasExif || exif.hasGps || exif.hasCameraInfo ? "Detected" : "Not detected";
  const hasIptcXmp =
    iptcXmp.hasIptc ||
    Object.keys(iptcXmp.xmp).length > 0 ||
    Object.keys(iptcXmp.textChunks).length > 0;
  iptcXmp.status = hasIptcXmp ? "Detected" : "Not detected";

  const detectedFields = Array.from(personalSet);
  const integrityStatus: InspectionStatusLabel =
    extMatch && structureValid ? "Verified" : "Inspection failed";

  return {
    fileInfo: {
      fileName,
      mimeType: realMime,
      detectedFormat: formatLabel,
      mediaKind,
      fileSizeBytes: bytes.length,
      sha256,
      width,
      height,
      durationSec,
      inspectedAt,
    },
    integrity: {
      status: integrityStatus,
      supported: true,
      magicBytesValid: true,
      extensionMatchesHeader: extMatch,
      structureValid,
      pixelDecodeValid: null,
      polyglotSafe: true,
      notes,
    },
    exif,
    iptcXmp,
    videoInfo,
    personalMetadata: {
      status: detectedFields.length > 0 ? "Detected" : "Not detected",
      hasPersonalMetadata: detectedFields.length > 0,
      detectedFields,
    },
    hasC2paBox,
  };
}

export async function inspectMediaFileLocally(
  file: File
): Promise<LocalMediaInspection> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const base = await inspectBufferMetadata(buf, file.name, file.type);

  if (!base.integrity.supported) {
    return base;
  }

  const objUrl = URL.createObjectURL(file);
  try {
    if (base.fileInfo.mediaKind === "image") {
      const imgCheck = await new Promise<{ ok: boolean; w?: number; h?: number }>(
        (resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve(
              img.naturalWidth > 0 && img.naturalHeight > 0
                ? { ok: true, w: img.naturalWidth, h: img.naturalHeight }
                : { ok: false }
            );
          img.onerror = () => resolve({ ok: false });
          img.src = objUrl;
        }
      );

      base.integrity.pixelDecodeValid = imgCheck.ok;
      if (imgCheck.ok) {
        base.fileInfo.width = base.fileInfo.width ?? imgCheck.w;
        base.fileInfo.height = base.fileInfo.height ?? imgCheck.h;
      } else {
        base.integrity.status = "Inspection failed";
        base.integrity.notes.push(
          "Image pixel stream is corrupted or could not be decoded in this browser."
        );
      }
    } else if (base.fileInfo.mediaKind === "video") {
      const vidCheck = await new Promise<{ ok: boolean; w?: number; h?: number; d?: number }>(
        (resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () =>
            resolve({
              ok: true,
              w: video.videoWidth || undefined,
              h: video.videoHeight || undefined,
              d: Number.isFinite(video.duration) && video.duration > 0 ? Number(video.duration.toFixed(2)) : undefined,
            });
          video.onerror = () => resolve({ ok: false });
          video.src = objUrl;
        }
      );

      base.fileInfo.width = base.fileInfo.width ?? vidCheck.w;
      base.fileInfo.height = base.fileInfo.height ?? vidCheck.h;
      base.fileInfo.durationSec = base.fileInfo.durationSec ?? vidCheck.d;
      base.videoInfo.width = base.videoInfo.width ?? vidCheck.w;
      base.videoInfo.height = base.videoInfo.height ?? vidCheck.h;
      base.videoInfo.durationSec = base.videoInfo.durationSec ?? vidCheck.d;
      if (
        !base.videoInfo.bitrateKbps &&
        base.videoInfo.durationSec &&
        base.videoInfo.durationSec > 0
      ) {
        base.videoInfo.bitrateKbps = Math.round(
          (base.fileInfo.fileSizeBytes * 8) / (base.videoInfo.durationSec * 1000)
        );
      }
    }
  } finally {
    URL.revokeObjectURL(objUrl);
  }

  return base;
}
