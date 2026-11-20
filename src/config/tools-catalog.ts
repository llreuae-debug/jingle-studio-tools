export type ToolCategory = "inspection" | "privacy" | "image";

export interface ToolFaqItem {
  q: string;
  a: string;
}

export interface ToolCatalogEntry {
  id: string;
  title: string;
  href: string;
  category: ToolCategory;
  badge: string;
  description: string;
  formats: string;
  executionScope: "Local Browser" | "Local + Optional Server Clean";
  primaryKeyword: string;
  howItWorksSteps: string[];
  keyFeatures: string[];
  privacySummary: string;
  faqs: ToolFaqItem[];
  relatedArticles: Array<{ slug: string; title: string }>;
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
    primaryKeyword: "online media metadata inspector",
    howItWorksSteps: [
      "Drop or select one or more PNG, JPG, WebP, MP4, MOV, or WebM files in the inspection workspace.",
      "The browser parses magic-byte signatures, container boxes, EXIF/IPTC/XMP blocks, and C2PA manifests locally in memory.",
      "Review the 8-category inspection report and before/after verification summary table.",
      "Export a structured JSON or human-readable PDF 1.4 report, or optionally confirm privacy metadata cleaning.",
    ],
    keyFeatures: [
      "8-category inspection covering file info, EXIF, IPTC/XMP, C2PA provenance, SynthID status, video streams, and file integrity",
      "100% client-side binary parsing with Web Crypto SHA-256 fingerprinting",
      "Multi-file queue support with instant switching and individual removal",
      "One-click JSON and PDF 1.4 inspection report downloads",
    ],
    privacySummary:
      "All metadata and provenance checks run locally inside your browser tab. Files are never uploaded during inspection.",
    faqs: [
      {
        q: "How can I check image and video metadata online without uploading my file?",
        a: "Use JingleStudio's Media Metadata Inspector. It reads binary container headers, EXIF, IPTC, XMP, and C2PA manifests directly in your browser using the File and Web Crypto APIs, so your media never leaves your device during inspection.",
      },
      {
        q: "What information can media metadata contain?",
        a: "Media metadata can include technical properties (dimensions, codecs, bitrate, color profile, SHA-256 hash), capture data (camera model, lens, exposure, timestamps, GPS coordinates), editorial fields (IPTC creator and copyright), and C2PA Content Credentials.",
      },
      {
        q: "Does the inspector detect Google SynthID watermarks?",
        a: "No public client-side detector exists for Google SynthID pixel watermarks. Unless an authorized SynthID verification API is configured, the report honestly displays 'SynthID verification unavailable' and explains how to check via Google Gemini.",
      },
    ],
    relatedArticles: [
      { slug: "what-is-image-metadata", title: "What Is Image Metadata? EXIF, IPTC, XMP & C2PA Explained" },
      { slug: "how-to-read-a-content-credentials-report", title: "How to read a Content Credentials report" },
    ],
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
    primaryKeyword: "image exif viewer online",
    howItWorksSteps: [
      "Select a PNG, JPG, JPEG, or WebP image from your device.",
      "The browser parses TIFF IFD0, ExifIFD, and GPSIFD headers locally without uploading the image.",
      "Toggle GPS coordinates visibility to inspect latitude and longitude safely.",
      "Copy the extracted EXIF and XMP tags to your clipboard or download them as a JSON file.",
    ],
    keyFeatures: [
      "Reads camera make, model, lens, software, orientation, and capture timestamps",
      "Privacy-safe GPS coordinate masking with a show/hide toggle",
      "Supports JPEG APP1 EXIF, PNG eXIf/tEXt/iTXt chunks, and WebP EXIF chunks",
      "Instant JSON clipboard copy and file download",
    ],
    privacySummary:
      "EXIF and GPS parsing executes entirely in your browser memory. Zero bytes are sent to any server.",
    faqs: [
      {
        q: "What is an EXIF viewer?",
        a: "An EXIF viewer is a tool that reads Exchangeable Image File Format metadata embedded inside photos, revealing camera settings, device model, capture date, editing software, and GPS coordinates.",
      },
      {
        q: "Why are GPS coordinates hidden by default in the EXIF viewer?",
        a: "GPS coordinates can reveal a home or workplace address if shared on screen. JingleStudio hides exact coordinates by default until you click 'Show GPS coordinates'.",
      },
      {
        q: "Which image formats support EXIF metadata?",
        a: "JPEG/JPG, PNG (via the eXIf chunk), and WebP (via the RIFF EXIF chunk) can all store EXIF and GPS metadata.",
      },
    ],
    relatedArticles: [
      { slug: "how-to-view-exif-data-in-an-image", title: "How to View EXIF Data in an Image Online" },
      { slug: "how-to-protect-personal-information-in-image-metadata", title: "How to Protect Personal Information in Image Metadata" },
    ],
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
    primaryKeyword: "c2pa content credentials checker",
    howItWorksSteps: [
      "Drop a photo or video into the Content Credentials checker.",
      "WebAssembly C2PA verification inspects the embedded JUMBF manifest store and cryptographic signatures.",
      "Review the signer certificate, signing timestamp, tool declarations, and ingredient hierarchy.",
    ],
    keyFeatures: [
      "Cryptographic signature validation against active C2PA trust anchors",
      "Inspects AI generation assertions (trainedAlgorithmicMedia, compositeWithTrainedAlgorithmicMedia)",
      "Displays parent ingredient manifests and editing action history",
      "Never alters or strips original provenance manifests",
    ],
    privacySummary:
      "C2PA manifest parsing runs in your browser via WebAssembly; your media file is not uploaded.",
    faqs: [
      {
        q: "What is a C2PA Content Credential?",
        a: "C2PA Content Credentials are tamper-evident cryptographic manifests embedded in media files that declare who created or edited the file, which software or AI model was used, and whether the signature is intact.",
      },
      {
        q: "Does missing Content Credentials prove an image was not made with AI?",
        a: "No. Missing Content Credentials only means no C2PA manifest was found in the file. Many cameras and AI generators do not embed C2PA metadata by default, and social platforms often strip container metadata.",
      },
      {
        q: "What is the difference between Valid and Unrecognized C2PA status?",
        a: "'Valid' means the cryptographic signature matches the file bytes and the signing certificate chains to a recognized trust list anchor. 'Unrecognized' means the signature is intact, but the certificate issuer is not on the active trust list.",
      },
    ],
    relatedArticles: [
      { slug: "how-to-read-a-content-credentials-report", title: "How to read a Content Credentials report" },
      { slug: "content-credentials-and-synthid", title: "Content Credentials and SynthID: what each one does" },
    ],
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
    primaryKeyword: "file integrity checker sha256 online",
    howItWorksSteps: [
      "Select any supported image or video file to inspect its binary structure.",
      "Verify the 5-point integrity checklist: magic bytes, extension match, container structure, polyglot check, and browser decode.",
      "Copy the computed 64-character SHA-256 hex digest or paste an expected SHA-256 hash to verify an exact byte match.",
    ],
    keyFeatures: [
      "Detects mismatched file extensions (e.g., an HTML or WebP file renamed to .png)",
      "Checks PNG IHDR/IEND, JPEG SOI/EOI, WebP RIFF, ISO-BMFF ftyp/moov, and WebM EBML structure",
      "Screens leading bytes for disguised HTML/script polyglot payloads",
      "Hardware-accelerated Web Crypto SHA-256 checksum computation and comparison",
    ],
    privacySummary:
      "Hashing and header verification happen locally in your browser using crypto.subtle.digest('SHA-256').",
    faqs: [
      {
        q: "How can I check file integrity and verify a SHA-256 checksum online?",
        a: "Upload your file in the File Integrity Checker to compute its SHA-256 hash locally and paste your expected checksum into the comparison box to confirm whether every byte matches.",
      },
      {
        q: "What is a magic-byte signature check?",
        a: "Every media format begins with specific hexadecimal bytes (such as 89 50 4E 47 for PNG or FF D8 FF for JPEG). Checking magic bytes confirms the true format regardless of the filename extension.",
      },
      {
        q: "Why did my image fail the browser decode check?",
        a: "If a file has valid header bytes but truncated or corrupted compressed pixel data, the browser decoder rejects it and reports a decode failure.",
      },
    ],
    relatedArticles: [
      { slug: "understanding-digital-media-provenance", title: "Understanding Digital Media Provenance & File Integrity" },
      { slug: "what-is-image-metadata", title: "What Is Image Metadata? EXIF, IPTC, XMP & C2PA Explained" },
    ],
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
    primaryKeyword: "image format converter online",
    howItWorksSteps: [
      "Select a PNG, JPEG, or WebP image from your device.",
      "Choose your target output format (WebP, JPEG, or PNG), encoder quality (10–100%), and JPEG background fill color for transparent images.",
      "Preview the converted output dimensions and byte-size comparison.",
      "Click 'Download Converted Image' to save the new derivative file.",
    ],
    keyFeatures: [
      "Bidirectional conversion between PNG, JPEG, and WebP in the browser",
      "Adjustable lossy quality slider for JPEG and WebP outputs",
      "Custom background fill color when converting transparent PNG/WebP files to JPEG",
      "Clear disclosure that Canvas re-encoding creates a clean derivative without container metadata",
    ],
    privacySummary:
      "Format conversion uses your browser's HTML5 2D Canvas encoder. Your image is never uploaded to a server.",
    faqs: [
      {
        q: "Which image format should I choose: WebP, JPEG, or PNG?",
        a: "Use WebP for modern websites where you want smaller file sizes and transparency support, JPEG for universal photo compatibility without transparency, and PNG for lossless graphics or screenshots.",
      },
      {
        q: "What happens to transparent areas when converting PNG to JPEG?",
        a: "Because JPEG does not support an alpha transparency channel, the converter fills transparent pixels with your chosen background color (white #ffffff by default).",
      },
      {
        q: "Does browser format conversion preserve EXIF or C2PA metadata?",
        a: "No. HTML5 Canvas re-encodes raw pixel data into a new derivative file, which strips container metadata and C2PA manifests from the converted copy while leaving your original file untouched.",
      },
    ],
    relatedArticles: [
      { slug: "image-compression-and-resizing-explained", title: "Image Compression & Resizing Explained" },
      { slug: "what-is-image-metadata", title: "What Is Image Metadata? EXIF, IPTC, XMP & C2PA Explained" },
    ],
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
    primaryKeyword: "image resizer online",
    howItWorksSteps: [
      "Select a PNG, JPEG, or WebP image to load its original pixel dimensions.",
      "Enter a target width or height (with aspect-ratio lock enabled) or click a preset (1080×1080, 1920×1080, 1280×720, 320×240).",
      "Choose your output format (PNG, JPEG, or WebP) and click 'Apply Resize'.",
      "Review the preview and click 'Download Resized Image'.",
    ],
    keyFeatures: [
      "High-quality bicubic Canvas resampling up to 8192×8192 pixels",
      "Automatic aspect-ratio lock to prevent stretching or distortion",
      "One-click social and HD dimension presets",
      "Instant before-and-after dimension and file-size readout",
    ],
    privacySummary:
      "All resizing happens locally inside your browser via HTML5 Canvas with zero server uploads.",
    faqs: [
      {
        q: "Does resizing an image reduce quality?",
        a: "Downscaling an image reduces its pixel count while preserving visual sharpness for smaller displays. Upscaling an image beyond its original dimensions interpolates new pixels and cannot add new real detail.",
      },
      {
        q: "How do I resize an image without stretching it?",
        a: "Keep the 'Lock aspect ratio' checkbox enabled. When you enter a new width, the resizer automatically calculates the proportional height.",
      },
      {
        q: "Can I resize and convert the format at the same time?",
        a: "Yes. You can select PNG, JPEG, or WebP as the output format while resizing.",
      },
    ],
    relatedArticles: [
      { slug: "image-compression-and-resizing-explained", title: "Image Compression & Resizing Explained" },
      { slug: "how-to-disclose-ai-use-in-property-marketing", title: "How to disclose AI use in property marketing" },
    ],
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
    primaryKeyword: "image compressor online",
    howItWorksSteps: [
      "Select a PNG, JPEG, or WebP image to compress.",
      "Choose JPEG or WebP output codec, adjust the quality slider (10–100%), and optionally set a maximum width cap.",
      "Inspect the real byte reduction and percentage saved calculated directly from the encoded output blob.",
      "Click 'Download Compressed Image' to save the optimized file.",
    ],
    keyFeatures: [
      "Real byte-size comparison and percentage savings (never estimated or fabricated)",
      "Supports modern WebP and universal JPEG compression codecs",
      "Optional max-width downscaling for large camera photos",
      "100% local browser execution with instant visual preview",
    ],
    privacySummary:
      "Image compression runs entirely in your browser tab. No files are uploaded to any server.",
    faqs: [
      {
        q: "What is image compression and how much space can it save?",
        a: "Image compression reduces file size by encoding pixel data more efficiently in JPEG or WebP format. At 75–85% quality, large photos often shrink by 50–80% with minimal visible difference.",
      },
      {
        q: "Why does compressing a tiny image sometimes increase byte size at 100% quality?",
        a: "Re-encoding an already heavily compressed image at 95–100% quality can allocate more bits than the original. Lowering the quality slider to 70–80% or switching to WebP reduces the output size.",
      },
      {
        q: "Are the compression savings shown calculated from the real file?",
        a: "Yes. JingleStudio measures the exact byte length of the generated output Blob against your original file size.",
      },
    ],
    relatedArticles: [
      { slug: "image-compression-and-resizing-explained", title: "Image Compression & Resizing Explained" },
      { slug: "what-is-image-metadata", title: "What Is Image Metadata? EXIF, IPTC, XMP & C2PA Explained" },
    ],
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
    primaryKeyword: "video metadata inspector online",
    howItWorksSteps: [
      "Select or drop an MP4, MOV, or WebM video file into the workspace.",
      "The browser parses ISO-BMFF (ftyp, moov, mvhd, trak, stsd, udta) or Matroska/WebM EBML elements locally.",
      "Review container brand, video codec, resolution, duration, frame rate, overall bitrate, and audio stream channels/sample rate.",
      "Export a JSON or PDF 1.4 inspection report or optionally clean container metadata.",
    ],
    keyFeatures: [
      "Parses MP4/MOV ISO-BMFF boxes and WebM EBML tracks in the browser",
      "Extracts video codec (H.264/avc1, HEVC/hvc1, VP9, AV1), resolution, duration, FPS, and bitrate",
      "Detects audio track codec (AAC/mp4a, Opus, Vorbis), channel count, and sample rate (Hz)",
      "Clearly discloses container-level inspection scope versus frame-by-frame stream decoding",
    ],
    privacySummary:
      "Video container and stream metadata are parsed locally in your browser without uploading the video.",
    faqs: [
      {
        q: "How do I inspect a video file's codec, bitrate, and audio stream online?",
        a: "Drop your MP4, MOV, or WebM file into the Video Metadata Inspector. It parses the container's track headers locally in your browser to report video codec, resolution, duration, overall bitrate, and audio stream parameters.",
      },
      {
        q: "Does the Video Metadata Inspector analyze every video frame?",
        a: "No. The inspector reads container-level boxes and stream headers (such as moov/trak/stsd in MP4/MOV and Info/Tracks in WebM), not decoded frame-by-frame bitstreams.",
      },
      {
        q: "Can video files contain GPS location and C2PA Content Credentials?",
        a: "Yes. MP4 and MOV containers can store ISO-6709 GPS coordinates inside udta/meta atoms and C2PA JUMBF manifests inside uuid boxes, both of which are detected by the inspector.",
      },
    ],
    relatedArticles: [
      { slug: "how-to-inspect-video-metadata", title: "How to Inspect Video Metadata Online (MP4, MOV & WebM)" },
      { slug: "how-to-read-a-content-credentials-report", title: "How to read a Content Credentials report" },
    ],
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
    primaryKeyword: "privacy metadata cleaner online",
    howItWorksSteps: [
      "Select an image or video to inspect its embedded EXIF, GPS, IPTC/XMP, and C2PA metadata locally.",
      "Choose which personal metadata categories to remove (GPS location, camera info, EXIF tags, personal descriptive blocks).",
      "Click 'Clean Privacy Metadata' and review the confirmation dialog detailing exact fields to be removed.",
      "Confirm to generate a separate, verified privacy-cleaned copy for download while keeping your original file unchanged.",
    ],
    keyFeatures: [
      "Explicit native confirmation modal listing exact personal metadata fields before cleaning",
      "Preserves cryptographic C2PA Content Credentials intact whenever present",
      "Never overwrites your original file — always outputs a verified separate copy",
      "Before-and-after verification table comparing integrity, EXIF, C2PA, SynthID, and personal metadata",
    ],
    privacySummary:
      "Initial inspection is 100% local. Server-side cleaning runs only after you click 'Confirm & Clean Copy', and temporary server files expire and are purged automatically.",
    faqs: [
      {
        q: "How can I remove GPS coordinates and personal EXIF data from a photo before sharing?",
        a: "Load your photo in the Privacy Metadata Cleaner, review the detected personal tags, click 'Clean Privacy Metadata', and confirm to download a separate copy with GPS and device serials stripped.",
      },
      {
        q: "Does removing personal EXIF metadata remove AI origin or C2PA Content Credentials?",
        a: "No. JingleStudio's Privacy Metadata Cleaner is designed to protect personal privacy (such as home GPS coordinates and device serial numbers) while preserving C2PA Content Credentials intact. It never strips pixel-level watermarks like SynthID.",
      },
      {
        q: "Is my original file modified when I run the cleaner?",
        a: "Never. Your original file remains untouched on your device and can also be downloaded directly alongside the newly generated privacy-cleaned copy.",
      },
    ],
    relatedArticles: [
      { slug: "how-to-protect-personal-information-in-image-metadata", title: "How to Protect Personal Information in Image Metadata" },
      { slug: "content-credentials-and-synthid", title: "Content Credentials and SynthID: what each one does" },
    ],
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
    primaryKeyword: "media inspection report generator",
    howItWorksSteps: [
      "Drop any supported image or video file into the report generator workspace.",
      "Wait a moment for local browser inspection of all 8 metadata, provenance, and integrity categories.",
      "Click 'Download JSON Report' for machine-readable audit data or 'Download PDF Report' for a formatted PDF 1.4 document.",
    ],
    keyFeatures: [
      "Zero-dependency standards-compliant PDF 1.4 document generation in the browser",
      "Structured schemaVersion 1.0 JSON export including SHA-256 hashes and C2PA manifest summaries",
      "Clearly documents verification limitations and unavailable checks (such as unconfigured SynthID)",
      "Ideal for compliance archives, editorial handoffs, and client deliverables",
    ],
    privacySummary:
      "Both JSON and PDF 1.4 reports are generated locally in your browser memory without server calls.",
    faqs: [
      {
        q: "What is included in a Media Inspection Report?",
        a: "Each report records the inspection timestamp, file name, MIME type, byte size, SHA-256 checksum, dimensions, EXIF/IPTC/XMP findings, C2PA verification status, video stream details, integrity checks, and verification limitations.",
      },
      {
        q: "Are PDF and JSON inspection reports generated locally?",
        a: "Yes. Both the JSON serializer and the PDF 1.4 generator run inside your browser tab with zero external API dependencies.",
      },
      {
        q: "Can I export a report after running privacy metadata cleaning?",
        a: "Yes. Exporting a report after cleaning includes the privacyCleanSummary block documenting which personal metadata fields were removed and the output SHA-256 digest.",
      },
    ],
    relatedArticles: [
      { slug: "how-to-read-a-content-credentials-report", title: "How to read a Content Credentials report" },
      { slug: "understanding-digital-media-provenance", title: "Understanding Digital Media Provenance & File Integrity" },
    ],
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
  {
    title: "YouTube AI Label Check",
    href: "/tools/youtube-ai-label-check",
    description:
      "Check C2PA provenance and YouTube Studio altered or synthetic content disclosure readiness.",
    tag: "Social Placement",
  },
  {
    title: "Facebook AI Label Check",
    href: "/tools/facebook-ai-label-check",
    description:
      "Verify C2PA Content Credentials and Meta AI Info label readiness for Facebook posts and Reels.",
    tag: "Social Placement",
  },
  {
    title: "X (Twitter) AI Label Check",
    href: "/tools/x-ai-label-check",
    description:
      "Check C2PA provenance, aspect ratio fit, and synthetic media disclosure best practices for X.",
    tag: "Social Placement",
  },
];
