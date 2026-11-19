export type ToolCategory = "inspection" | "privacy" | "image";

export interface ToolCatalogEntry {
  id: string;
  title: string;
  href: string;
  category: ToolCategory;
  badge: string;
  description: string;
  formats: string;
  executionScope: "Local Browser" | "Local + Optional Server Clean";
}

export const CORE_TOOLS: ToolCatalogEntry[] = [
  {
    id: "media-metadata-inspector",
    title: "Media Metadata Inspector",
    href: "/tools/media-metadata-inspector",
    category: "inspection",
    badge: "8-Category Report",
    description:
      "Inspect file headers, EXIF, IPTC, XMP, C2PA Content Credentials, SynthID availability, and container integrity in your browser.",
    formats: "PNG, JPG, WebP, MP4, MOV, WebM",
    executionScope: "Local Browser",
  },
  {
    id: "exif-viewer",
    title: "Image EXIF Viewer",
    href: "/tools/exif-viewer",
    category: "inspection",
    badge: "Camera & GPS",
    description:
      "Read camera make/model, software tags, capture timestamps, and toggle GPS coordinates with JSON export.",
    formats: "PNG, JPG, JPEG, WebP",
    executionScope: "Local Browser",
  },
  {
    id: "content-credentials-check",
    title: "C2PA Credential Verifier",
    href: "/tools/content-credentials-check",
    category: "inspection",
    badge: "Provenance",
    description:
      "Verify cryptographic C2PA Content Credentials manifests, signing authorities, and assertion chains locally.",
    formats: "PNG, JPG, WebP, MP4, MOV",
    executionScope: "Local Browser",
  },
  {
    id: "file-integrity-checker",
    title: "File Integrity Checker",
    href: "/tools/file-integrity-checker",
    category: "inspection",
    badge: "SHA-256 & Headers",
    description:
      "Validate magic-byte signatures, extension matches, polyglot headers, container structure, and SHA-256 checksums.",
    formats: "PNG, JPG, WebP, MP4, MOV, WebM",
    executionScope: "Local Browser",
  },
  {
    id: "image-converter",
    title: "Image Format Converter",
    href: "/tools/image-converter",
    category: "image",
    badge: "PNG / JPG / WebP",
    description:
      "Convert images between PNG, JPEG, and WebP locally using HTML5 Canvas with quality and background fill controls.",
    formats: "PNG, JPG, JPEG, WebP",
    executionScope: "Local Browser",
  },
  {
    id: "image-resizer",
    title: "Image Resizer",
    href: "/tools/image-resizer",
    category: "image",
    badge: "Dimensions",
    description:
      "Resize images to exact pixel dimensions or social presets with aspect-ratio lock and verified browser export.",
    formats: "PNG, JPG, JPEG, WebP",
    executionScope: "Local Browser",
  },
  {
    id: "image-compressor",
    title: "Image Compression Tool",
    href: "/tools/image-compressor",
    category: "image",
    badge: "Size Optimizer",
    description:
      "Compress JPEG and WebP images with live byte savings and optional max-width scaling directly in your browser.",
    formats: "PNG, JPG, JPEG, WebP",
    executionScope: "Local Browser",
  },
  {
    id: "video-metadata-inspector",
    title: "Video Metadata Inspector",
    href: "/tools/video-metadata-inspector",
    category: "inspection",
    badge: "Container & Streams",
    description:
      "Inspect MP4, MOV, and WebM container boxes, codecs, resolution, duration, bitrate, and audio stream properties.",
    formats: "MP4, MOV, WebM",
    executionScope: "Local Browser",
  },
  {
    id: "privacy-metadata-cleaner",
    title: "Privacy Metadata Cleaner",
    href: "/tools/privacy-metadata-cleaner",
    category: "privacy",
    badge: "Preserves C2PA",
    description:
      "Generate a separate privacy-cleaned copy with GPS, EXIF device tags, and personal metadata removed while preserving C2PA.",
    formats: "PNG, JPG, WebP, MP4, MOV, WebM",
    executionScope: "Local + Optional Server Clean",
  },
  {
    id: "report-generator",
    title: "Media Inspection Report Generator",
    href: "/tools/report-generator",
    category: "inspection",
    badge: "JSON & PDF Export",
    description:
      "Generate structured JSON and human-readable PDF 1.4 inspection reports covering metadata, provenance, and integrity.",
    formats: "PNG, JPG, WebP, MP4, MOV, WebM",
    executionScope: "Local Browser",
  },
];

export const SPECIALIZED_TOOLS: Array<{
  title: string;
  href: string;
  description: string;
  tag: string;
}> = [
  {
    title: "AI Disclosure Signer",
    href: "/tools/ai-disclosure-signer",
    description:
      "Embed verifiable C2PA AI-generation disclosure credentials into media files (requires sign-in).",
    tag: "Provenance Signing",
  },
  {
    title: "Instagram Post Check",
    href: "/tools/instagram-post-check",
    description:
      "Preview how Instagram feed posts display AI disclosure labels and safe-zone crops.",
    tag: "Social Placement",
  },
  {
    title: "Instagram Story Check",
    href: "/tools/instagram-story-check",
    description:
      "Check 9:16 Instagram Story safe zones and AI label visibility before publishing.",
    tag: "Social Placement",
  },
  {
    title: "Instagram Reels Check",
    href: "/tools/instagram-reels-check",
    description:
      "Verify vertical Reels overlay regions and disclosure label positioning.",
    tag: "Social Placement",
  },
  {
    title: "TikTok AI Label Check",
    href: "/tools/tiktok-ai-label-check",
    description:
      "Inspect TikTok AIGC label placement and bottom caption overlay safe zones.",
    tag: "Social Placement",
  },
];
