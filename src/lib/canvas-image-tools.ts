"use client";

export type CanvasOutputMime = "image/png" | "image/jpeg" | "image/webp";

export interface CanvasTransformResult {
  blob: Blob;
  previewUrl: string;
  fileName: string;
  mimeType: CanvasOutputMime;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  outputBytes: number;
}

export function sanitizeOutputFilename(rawName: string): string {
  return (
    rawName
      .replace(/[/\\:*?"<>|\r\n\0]+/g, "_")
      .replace(/\.{2,}/g, ".")
      .trim() || "output"
  );
}

export function triggerVerifiedBlobDownload(blob: Blob, fileName: string): void {
  if (!blob || blob.size === 0) {
    throw new Error("Generated output file is empty and cannot be downloaded.");
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeOutputFilename(fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function extForMime(mime: CanvasOutputMime): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function baseNameOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return sanitizeOutputFilename(dot > 0 ? name.slice(0, dot) : name);
}

async function decodeFileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve(img);
        } else {
          reject(new Error(`Image "${file.name}" has invalid dimensions.`));
        }
      };
      img.onerror = () =>
        reject(
          new Error(
            `Image "${file.name}" is corrupted or cannot be decoded by this browser.`
          )
        );
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderCanvasToResult(params: {
  img: HTMLImageElement;
  targetWidth: number;
  targetHeight: number;
  mimeType: CanvasOutputMime;
  quality: number;
  backgroundFill?: string;
  outName: string;
  originalBytes: number;
}): Promise<CanvasTransformResult> {
  const w = Math.max(1, Math.min(16384, Math.round(params.targetWidth)));
  const h = Math.max(1, Math.min(16384, Math.round(params.targetHeight)));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D Canvas context is unavailable in this browser.");
  }

  if (params.mimeType === "image/jpeg") {
    ctx.fillStyle = params.backgroundFill || "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(params.img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b && b.size > 0) resolve(b);
        else reject(new Error("Canvas encoder returned an empty output file."));
      },
      params.mimeType,
      params.mimeType === "image/png" ? undefined : Math.max(0.05, Math.min(1, params.quality))
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return {
    blob,
    previewUrl,
    fileName: params.outName,
    mimeType: params.mimeType,
    width: w,
    height: h,
    originalWidth: params.img.naturalWidth,
    originalHeight: params.img.naturalHeight,
    originalBytes: params.originalBytes,
    outputBytes: blob.size,
  };
}

export async function convertImageLocally(params: {
  file: File;
  targetMime: CanvasOutputMime;
  quality?: number;
  jpegBg?: string;
}): Promise<CanvasTransformResult> {
  const img = await decodeFileToImage(params.file);
  const outName = `${baseNameOf(params.file.name)}-converted${extForMime(params.targetMime)}`;
  return renderCanvasToResult({
    img,
    targetWidth: img.naturalWidth,
    targetHeight: img.naturalHeight,
    mimeType: params.targetMime,
    quality: params.quality ?? 0.92,
    backgroundFill: params.jpegBg || "#ffffff",
    outName,
    originalBytes: params.file.size,
  });
}

export async function resizeImageLocally(params: {
  file: File;
  width: number;
  height: number;
  targetMime: CanvasOutputMime;
  quality?: number;
}): Promise<CanvasTransformResult> {
  const img = await decodeFileToImage(params.file);
  const outName = `${baseNameOf(params.file.name)}-${Math.round(params.width)}x${Math.round(params.height)}${extForMime(params.targetMime)}`;
  return renderCanvasToResult({
    img,
    targetWidth: params.width,
    targetHeight: params.height,
    mimeType: params.targetMime,
    quality: params.quality ?? 0.92,
    backgroundFill: "#ffffff",
    outName,
    originalBytes: params.file.size,
  });
}

export async function compressImageLocally(params: {
  file: File;
  targetMime: "image/jpeg" | "image/webp";
  quality: number;
  maxWidth?: number;
}): Promise<CanvasTransformResult> {
  const img = await decodeFileToImage(params.file);
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (params.maxWidth && params.maxWidth > 0 && w > params.maxWidth) {
    const ratio = params.maxWidth / w;
    w = params.maxWidth;
    h = Math.max(1, Math.round(h * ratio));
  }
  const outName = `${baseNameOf(params.file.name)}-compressed${extForMime(params.targetMime)}`;
  return renderCanvasToResult({
    img,
    targetWidth: w,
    targetHeight: h,
    mimeType: params.targetMime,
    quality: params.quality,
    backgroundFill: "#ffffff",
    outName,
    originalBytes: params.file.size,
  });
}
