# JingleStudio SEO, GEO, AEO & Responsive Media Strategy

**Canonical Domain:** `https://jinglestudio.io`  
**Primary Hub:** `https://jinglestudio.io/tools`  
**Audit & Implementation Date:** `2026-11-20`

---

## 1. Complete Website Technical SEO Audit

| Audit Dimension | Before Upgrade | Action Taken / Verified State |
| --- | --- | --- |
| **Title & Meta Descriptions** | Unique across core pages, but tool pages lacked extended crawlable copy. | Verified unique `<title>` and `<meta name="description">` across all 45 public routes. |
| **Heading Hierarchy (`H1` -> `H2` -> `H3`)** | Single `H1` per page. | Preserved single `H1` per route with logical `H2`/`H3` sub-sections on all tool and blog pages. |
| **Landmark Semantics (`<main>`)** | `ToolPageShell` rendered an inner `<main>` inside `RootLayout`'s `<main id="main-content">`. | Replaced inner `<main>` in `ToolPageShell.tsx` with `<section aria-label="...">` so every page has exactly one `<main>` landmark. |
| **Structured Data (JSON-LD)** | Root had `Organization`; `/tools` had `FAQPage`. | Upgraded root to `@graph` (`Organization` + `WebSite`); added `BreadcrumbList` + `SoftwareApplication` + `FAQPage` to all `/tools/*` routes and `BreadcrumbList` + `Article` + `FAQPage` to all 10 `/blog/[slug]` articles. |
| **GEO & AEO Crawlable Content** | Tool pages only rendered the interactive workbench header above the fold. | Added crawlable HTML sections to every tool landing page: *How It Works*, *Key Capabilities*, *Supported Formats & Privacy*, *Direct-Answer FAQs*, and *Related Guides*. |
| **Educational Content (`/blog`)** | 4 articles. | Expanded to 10 original, bilingual (`en`/`id`) technical guides with AEO direct-answer Q&As, publication/updated dates, and internal tool links. |
| **Responsive Media & CLS** | Dynamic `<img>` and `<video>` previews lacked explicit `width`/`height` attributes. | Added explicit integer `width` and `height` attributes on `<img>` and `<video>` elements plus global responsive media rules (`max-inline-size: 100%`) in `globals.css`. |
| **Sitemap & Robots** | `robots.txt` + `/sitemap.xml`. | Dynamic `/sitemap.xml` now indexes all 45 public routes (including all 10 core tools, 8 specialized/social tools, and 10 blog articles). |

---

## 2. Keyword Research & Page Mapping (Zero Cannibalization)

> **Methodology Note:** Keyword mapping is structured by user intent and technical topic cluster without fabricated search volumes or ranking promises. Each route targets a distinct primary intent.

### A. Core Tool Landing Pages

| Route | Primary Keyword Cluster | Secondary / Long-Tail Keywords | Question / AEO Intent |
| --- | --- | --- | --- |
| `/tools` | online media tools, AI media inspector | inspect image and video metadata, content credentials checker hub | How do I know what metadata is inside my media file? |
| `/tools/media-metadata-inspector` | online media metadata inspector | inspect EXIF IPTC XMP C2PA online, browser media inspector | How can I check image and video metadata online without uploading? |
| `/tools/exif-viewer` | image exif viewer online | view photo camera data and GPS coordinates, read EXIF tags | What is an EXIF viewer and why are GPS coordinates hidden? |
| `/tools/content-credentials-check` | c2pa content credentials checker | verify c2pa manifest online, check AI content credentials | What is a C2PA Content Credential? |
| `/tools/file-integrity-checker` | file integrity checker sha256 online | verify magic bytes and sha256 checksum, detect corrupted image | How can I check file integrity and verify a SHA-256 checksum? |
| `/tools/image-converter` | image format converter online | convert png jpg webp in browser, client-side image converter | Which image format should I choose: WebP, JPEG, or PNG? |
| `/tools/image-resizer` | image resizer online | resize image pixel dimensions lock aspect ratio | Does resizing an image reduce quality? |
| `/tools/image-compressor` | image compressor online | compress jpeg webp in browser, reduce image file size | What is image compression and how much space can it save? |
| `/tools/video-metadata-inspector` | video metadata inspector online | inspect mp4 mov webm codec bitrate audio stream | How do I inspect a video file's codec, bitrate, and audio stream? |
| `/tools/privacy-metadata-cleaner` | privacy metadata cleaner online | remove gps and personal exif from photo preserve c2pa | Does removing personal EXIF metadata remove C2PA credentials? |
| `/tools/report-generator` | media inspection report generator | export json pdf media metadata report | What is included in a Media Inspection Report? |
| `/tools/ai-disclosure-signer` | c2pa ai disclosure signer | sign media with content credentials, disclose AI assistance | How do I attach a C2PA AI disclosure manifest to an image? |

### B. Social Platform AI Label Placement Checkers

| Route | Primary Keyword Cluster | Target Platform Intent |
| --- | --- | --- |
| `/tools/instagram-post-check` | instagram ai label check feed post | Check C2PA signals & Instagram 4:5 / 1.91:1 feed format fit |
| `/tools/instagram-story-check` | instagram story ai label safe zone | Check 9:16 Story safe zones and AI disclosure steps |
| `/tools/instagram-reels-check` | instagram reels ai disclosure check | Check 9:16 Reels format fit and Meta AI label steps |
| `/tools/tiktok-ai-label-check` | tiktok aigc ai label checker | Check TikTok AI-generated content toggle requirements |
| `/tools/youtube-ai-label-check` | youtube altered or synthetic content check | Check YouTube Studio altered content disclosure steps |
| `/tools/facebook-ai-label-check` | facebook meta ai info label check | Check Facebook feed/Reels format fit and Meta AI label steps |
| `/tools/x-ai-label-check` | x twitter synthetic media c2pa check | Check X media aspect ratio and C2PA provenance signals |

### C. GEO & AEO Educational Articles (`/blog/[slug]`)

| Route | Target Informational / GEO Topic |
| --- | --- |
| `/blog/what-is-image-metadata` | What Is Image Metadata? EXIF, IPTC, XMP & C2PA Explained |
| `/blog/how-to-view-exif-data-in-an-image` | How to View EXIF Data in an Image Online (Camera, Lens & GPS) |
| `/blog/how-to-inspect-video-metadata` | How to Inspect Video Metadata Online (MP4, MOV & WebM Streams) |
| `/blog/image-compression-and-resizing-explained` | Image Compression & Resizing Explained: Quality, Formats & Dimensions |
| `/blog/understanding-digital-media-provenance` | Understanding Digital Media Provenance & File Integrity (SHA-256 & C2PA) |
| `/blog/how-to-protect-personal-information-in-image-metadata` | How to Protect Personal Information in Image & Video Metadata |
| `/blog/how-to-read-a-content-credentials-report` | How to read a Content Credentials report |
| `/blog/how-to-disclose-ai-use-in-property-marketing` | How to disclose AI use in property marketing |
| `/blog/what-to-do-if-a-real-photo-is-labelled-as-ai` | What to do if a real photo is labelled as AI |
| `/blog/content-credentials-and-synthid` | Content Credentials and SynthID: what each one does |

---

## 3. Analytics & Search Monitoring Guide

### Environment Variables (Configure in Vercel / Hostinger Environment Settings)
- `NEXT_PUBLIC_GSC_VERIFICATION`: Google Search Console HTML meta tag verification token.
- `NEXT_PUBLIC_BING_VERIFICATION`: Bing Webmaster Tools `msvalidate.01` verification token.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`).
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`: Microsoft Clarity Project ID (optional session replay/heatmaps).

### Privacy-Safe Event Taxonomy (`src/lib/analytics.ts`)
- `tool_opened`: Fired when a user navigates to `/tools` or any `/tools/*` route (`{ path }`).
- `file_uploaded`: Fired when a file is loaded into the local inspector (`{ mediaKind, format }` — never logs filenames or file contents).
- `processing_completed`: Fired when server-side privacy cleaning finishes (`{ mediaKind, processingTimeMs }`).
- `processing_failed`: Fired when server-side processing errors (`{ reason }`).
- `download_completed`: Fired when a verified output download succeeds (`{ kind }`).
- `tool_cta_clicked`: Available for primary CTA interactions.
