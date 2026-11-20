import { PLACEMENT_SPECS } from "@/config/platforms";
import type { Locale } from "@/lib/i18n";

export interface FaqEntry {
  q: { en: string; id: string };
  a: { en: string; id: string };
}

export function getFaqEntries(): FaqEntry[] {
  const supported = PLACEMENT_SPECS["content-credentials"].recommendedFormatsLabel;
  return [
    {
      q: {
        en: "What are Content Credentials?",
        id: "Apa itu Kredensial Konten?",
      },
      a: {
        en: "A signed record attached to a file that can show who signed it, how it was made and how it changed.",
        id: "Catatan bertanda tangan yang dilampirkan pada file untuk menunjukkan siapa yang menandatanganinya, bagaimana dibuatnya, dan bagaimana perubahannya.",
      },
    },
    {
      q: {
        en: "What is SynthID?",
        id: "Apa itu SynthID?",
      },
      a: {
        en: "An invisible watermark from Google for identifying content made with its AI tools. We do not detect, change or remove it. Google offers a check in the Gemini app.",
        id: "Watermark tak terlihat dari Google untuk mengidentifikasi konten yang dibuat dengan alat AI-nya. Kami tidak mendeteksi, mengubah, atau menghapusnya. Google menyediakan pemeriksaan di aplikasi Gemini.",
      },
    },
    {
      q: {
        en: "Is this an AI detector?",
        id: "Apakah ini pendeteksi AI?",
      },
      a: {
        en: "No. We read what a file declares. We cannot tell whether an unlabelled file used AI.",
        id: "Bukan. Kami membaca apa yang dideklarasikan file. Kami tidak dapat mengetahui apakah file tanpa label menggunakan AI.",
      },
    },
    {
      q: {
        en: "What does \"No Content Credentials\" mean?",
        id: "Apa arti \"Tidak Ada Kredensial Konten\"?",
      },
      a: {
        en: "No record was found. It does not mean the file is human-made or AI-made.",
        id: "Tidak ada catatan yang ditemukan. Itu tidak berarti file dibuat oleh manusia atau dibuat oleh AI.",
      },
    },
    {
      q: {
        en: "What does \"Unrecognized\" mean?",
        id: "Apa arti \"Tidak Dikenal\" (Unrecognized)?",
      },
      a: {
        en: "The file was signed, but the signer is not on the trust list used for the check.",
        id: "File telah ditandatangani, tetapi penanda tangannya tidak ada dalam daftar kepercayaan yang digunakan untuk pemeriksaan.",
      },
    },
    {
      q: {
        en: "Can you remove AI labels or credentials?",
        id: "Bisakah Anda menghapus label AI atau kredensial?",
      },
      a: {
        en: "No. We never remove or weaken provenance signals.",
        id: "Tidak. Kami tidak pernah menghapus atau melemahkan sinyal asal.",
      },
    },
    {
      q: {
        en: "Will signing change how platforms label my post?",
        id: "Apakah penandatanganan mengubah cara platform memberi label pada postingan saya?",
      },
      a: {
        en: "We cannot promise that. Each platform applies its own rules.",
        id: "Kami tidak dapat menjanjikan hal itu. Setiap platform menerapkan aturannya sendiri.",
      },
    },
    {
      q: {
        en: "My real photo was labelled as AI. What can I do?",
        id: "Foto asli saya diberi label AI. Apa yang bisa saya lakukan?",
      },
      a: {
        en: "Check which signals the file declares, then use the platform's official help or appeal page.",
        id: "Periksa sinyal apa yang dideklarasikan file, lalu gunakan halaman bantuan atau banding resmi platform.",
      },
    },
    {
      q: {
        en: "Are my files uploaded?",
        id: "Apakah file saya diunggah?",
      },
      a: {
        en: "Not for checks. Signing uploads files for processing and deletes them on schedule.",
        id: "Tidak untuk pemeriksaan. Penandatanganan mengunggah file untuk diproses dan menghapusnya sesuai jadwal.",
      },
    },
    {
      q: {
        en: "Which files are supported?",
        id: "File apa saja yang didukung?",
      },
      a: {
        en: `Browser checks currently support ${supported}. Server-side batch signing supports JPEG and PNG.`,
        id: `Pemeriksaan browser saat ini mendukung ${supported}. Penandatanganan batch di server mendukung JPEG dan PNG.`,
      },
    },
  ];
}

export interface BlogPost {
  slug: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  body: Record<Locale, string[]>;
  sources: Array<{ label: string; url: string }>;
  publishedAt?: string;
  updatedAt?: string;
  relatedTools?: Array<{ title: string; href: string }>;
  aeoQuestions?: Array<{ q: string; a: string }>;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-read-a-content-credentials-report",
    title: {
      en: "How to read a Content Credentials report",
      id: "Cara membaca laporan Kredensial Konten",
    },
    summary: {
      en: "Understand signer status, timestamps, actions, ingredient trees, and self-declared AI fields.",
      id: "Pahami status penanda tangan, stempel waktu, tindakan, pohon bahan, dan kolom AI yang dideklarasikan sendiri.",
    },
    body: {
      en: [
        "A Content Credentials report shows what was cryptographically signed inside a file's C2PA manifest store.",
        "Start with Credentials status: 'Valid' means the signature and file hash match and the certificate is on the trust list. 'Unrecognized' means the signature is intact, but the certificate is not on the trust list. 'Validation warning' means the file or manifest changed after signing.",
        "Next, inspect Signer, Signed on (shown in your local time), App or device, Actions, and Ingredients. Any author name or AI disclosure typed by a person is shown as self-declared.",
      ],
      id: [
        "Laporan Kredensial Konten menunjukkan apa yang ditandatangani secara kriptografis di dalam penyimpanan manifes C2PA file.",
        "Mulailah dengan status Kredensial: 'Valid' berarti tanda tangan dan hash file cocok serta sertifikat ada di daftar kepercayaan. 'Tidak dikenal' berarti tanda tangan utuh, tetapi sertifikat tidak ada di daftar kepercayaan.",
        "Selanjutnya, periksa Penanda Tangan, Ditandatangani pada, Aplikasi atau perangkat, Tindakan, dan Bahan. Nama kreator atau pengungkapan AI yang diketik pengguna ditampilkan sebagai deklarasi mandiri.",
      ],
    },
    sources: [
      { label: "Content Authenticity Initiative — Open-Source Docs", url: "https://opensource.contentauthenticity.org/docs/" },
      { label: "C2PA Trust & Conformance Program", url: "https://c2pa.org/" },
    ],
  },
  {
    slug: "how-to-disclose-ai-use-in-property-marketing",
    title: {
      en: "How to disclose AI use in property marketing",
      id: "Cara mengungkapkan penggunaan AI dalam pemasaran properti",
    },
    summary: {
      en: "Practical guidance for real estate marketers labelling virtual staging, sky replacements, and concept renders.",
      id: "Panduan praktis bagi pemasar properti dalam memberi label pementasan virtual dan render konsep.",
    },
    body: {
      en: [
        "Real estate teams often combine real photography with virtual staging, lighting edits, or concept renders. Clear provenance helps buyers and portals distinguish photography from AI-assisted visuals.",
        "When exporting edited listing media, preserve existing camera or studio Content Credentials as a parent ingredient and attach an honest AI disclosure—such as compositeWithTrainedAlgorithmicMedia for AI-edited originals or trainedAlgorithmicMedia for full AI renders.",
        "Pair C2PA metadata with plain-language captions and platform disclosure toggles on Instagram and TikTok.",
      ],
      id: [
        "Tim properti sering menggabungkan foto asli dengan pementasan virtual atau render konsep. Asal media yang jelas membantu pembeli membedakan foto asli dan visual berbantuan AI.",
        "Saat mengekspor media listing yang diedit, pertahankan Kredensial Konten asli sebagai bahan induk dan lampirkan pengungkapan AI yang jujur.",
        "Padukan metadata C2PA dengan takarir yang jelas dan tombol pengungkapan platform di Instagram dan TikTok.",
      ],
    },
    sources: [
      { label: "C2PA Synthetic Content Guidance", url: "https://c2pa.org/wp-content/uploads/sites/33/2026/07/Use-of-Content-Credentials-to-Identify-Synthetic-and-Non-Synthetic-Content.pdf" },
    ],
  },
  {
    slug: "what-to-do-if-a-real-photo-is-labelled-as-ai",
    title: {
      en: "What to do if a real photo is labelled as AI",
      id: "Apa yang harus dilakukan jika foto asli diberi label AI",
    },
    summary: {
      en: "How to inspect declared provenance signals in your file and reach the platform's official appeal process.",
      id: "Cara memeriksa sinyal asal yang dideklarasikan di file Anda dan menghubungi proses banding resmi platform.",
    },
    body: {
      en: [
        "Social platforms may apply an AI label when a file contains C2PA or IPTC digitalSourceType metadata from an editing tool (such as generative fill, AI denoising, or sky replacement).",
        "Drop the file into our browser checker to see which signals and ingredient manifests are declared. Keep original unedited captures and export logs ready if you contact platform support.",
        "We never strip or alter provenance signals. Instead, use the platform's official help or appeal page linked inside each placement checker.",
      ],
      id: [
        "Platform sosial dapat menerapkan label AI saat file berisi metadata C2PA atau IPTC digitalSourceType dari alat pengeditan (seperti generative fill atau AI denoising).",
        "Letakkan file di pemeriksa browser kami untuk melihat sinyal yang dideklarasikan. Simpan foto asli yang belum diedit untuk keperluan banding.",
        "Kami tidak pernah menghapus sinyal asal. Gunakan halaman bantuan atau banding resmi platform yang tertaut di setiap pemeriksa penempatan.",
      ],
    },
    sources: [
      { label: "Instagram AI Info & Label Help", url: "https://help.instagram.com/754107866669271" },
      { label: "TikTok AI-Generated Content Help", url: "https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content" },
    ],
  },
  {
    slug: "content-credentials-and-synthid",
    title: {
      en: "Content Credentials and SynthID: what each one does",
      id: "Kredensial Konten dan SynthID: fungsi masing-masing",
    },
    summary: {
      en: "Why C2PA metadata and Google SynthID watermarks are separate technologies and where each is checked.",
      id: "Mengapa metadata C2PA dan watermark Google SynthID adalah teknologi terpisah dan di mana masing-masing diperiksa.",
    },
    body: {
      en: [
        "Content Credentials (C2PA) attach a cryptographically signed manifest to a file describing who signed it, what tools were used, and its ingredient history.",
        "SynthID is Google's imperceptible watermarking technology embedded directly into pixels or audio generated by Google AI tools. SynthID is not part of the C2PA specification.",
        "Jingle Studio Tools inspects and signs C2PA Content Credentials. To check for Google SynthID watermarks, use Google's official check inside the Gemini app.",
      ],
      id: [
        "Kredensial Konten (C2PA) melampirkan manifes bertanda tangan kriptografis pada file untuk mencatat penanda tangan, alat yang digunakan, dan riwayat bahan.",
        "SynthID adalah teknologi watermark tak terlihat dari Google untuk konten buatan alat AI Google, dan terpisah dari spesifikasi C2PA.",
        "Jingle Studio Tools memeriksa dan menandatangani Kredensial Konten C2PA. Untuk memeriksa watermark SynthID Google, gunakan pemeriksaan resmi Google di aplikasi Gemini.",
      ],
    },
    sources: [
      { label: "Google Support — Verify AI content in Gemini", url: "https://support.google.com/gemini/answer/16722517?hl=en" },
      { label: "C2PA Implementation Guidance", url: "https://spec.c2pa.org/specifications/specifications/2.3/guidance/Guidance.html" },
    ],
    publishedAt: "2026-11-18",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "C2PA Credential Verifier", href: "/tools/content-credentials-check" },
      { title: "Media Metadata Inspector", href: "/tools/media-metadata-inspector" },
    ],
  },
  {
    slug: "what-is-image-metadata",
    title: {
      en: "What Is Image Metadata? EXIF, IPTC, XMP & C2PA Explained",
      id: "Apa Itu Metadata Gambar? Penjelasan EXIF, IPTC, XMP & C2PA",
    },
    summary: {
      en: "A practical technical guide to the four metadata standards embedded inside digital images: EXIF capture tags, IPTC press metadata, XMP editing history, and C2PA Content Credentials.",
      id: "Panduan teknis praktis tentang empat standar metadata yang tertanam di dalam gambar digital: EXIF, IPTC, XMP, dan Kredensial Konten C2PA.",
    },
    body: {
      en: [
        "Image metadata is structured information stored inside an image container alongside the visual pixel data. When a camera, smartphone, design tool, or AI generator saves a PNG, JPEG, or WebP file, it writes dedicated binary segments or chunks that describe how the file was created.",
        "EXIF (Exchangeable Image File Format) records device and capture parameters such as camera make, model, lens focal length, shutter speed, orientation, timestamps, and optional GPS latitude/longitude coordinates. IPTC and XMP blocks store editorial and workflow attributes including creator name, copyright notice, software agent, and digitalSourceType declarations.",
        "C2PA Content Credentials add a cryptographic layer on top of traditional metadata. Unlike plain EXIF or XMP text fields that anyone can edit, a C2PA manifest binds assertions and parent ingredients to the asset's cryptographic hash using an X.509 digital signature.",
      ],
      id: [
        "Metadata gambar adalah informasi terstruktur yang disimpan di dalam kontainer gambar bersama data piksel visual. Saat kamera, ponsel, atau alat desain menyimpan file PNG, JPEG, atau WebP, perangkat tersebut menulis segmen biner khusus yang menjelaskan cara file dibuat.",
        "EXIF mencatat parameter perangkat dan pengambilan seperti merek kamera, model, lensa, orientasi, waktu, dan koordinat GPS. Blok IPTC dan XMP menyimpan atribut editorial seperti nama pembuat, hak cipta, dan deklarasi digitalSourceType.",
        "Kredensial Konten C2PA menambahkan lapisan kriptografis di atas metadata tradisional dengan mengikat pernyataan dan bahan induk ke hash file menggunakan tanda tangan digital.",
      ],
    },
    sources: [
      { label: "CIPA EXIF 3.0 Standard Overview", url: "https://www.cipa.jp/std/documents/download_e.html?DC-008-Translation-2023-E" },
      { label: "IPTC Photo Metadata Standard", url: "https://iptc.org/standards/photo-metadata/iptc-standard/" },
      { label: "C2PA Technical Specification", url: "https://c2pa.org/specifications/specifications/2.1/specs/C2PA_Specification.html" },
    ],
    publishedAt: "2026-11-20",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "Media Metadata Inspector", href: "/tools/media-metadata-inspector" },
      { title: "Image EXIF Viewer", href: "/tools/exif-viewer" },
      { title: "C2PA Credential Verifier", href: "/tools/content-credentials-check" },
    ],
    aeoQuestions: [
      {
        q: "What are the main types of image metadata?",
        a: "The four main types of image metadata are EXIF (camera settings, timestamps, and GPS), IPTC (creator, copyright, and press descriptions), XMP (extensible XML editing and AI source declarations), and C2PA Content Credentials (cryptographically signed provenance manifests).",
      },
      {
        q: "Can I view image metadata without installing software?",
        a: "Yes. You can inspect EXIF, IPTC, XMP, and C2PA metadata directly in your web browser using JingleStudio's Media Metadata Inspector without uploading your file to a server.",
      },
    ],
  },
  {
    slug: "how-to-view-exif-data-in-an-image",
    title: {
      en: "How to View EXIF Data in an Image Online (Camera, Lens & GPS)",
      id: "Cara Melihat Data EXIF pada Gambar Secara Online (Kamera, Lensa & GPS)",
    },
    summary: {
      en: "Step-by-step instructions to inspect camera make, model, capture timestamps, software tags, and GPS coordinates in JPEG, PNG, and WebP images.",
      id: "Langkah demi langkah untuk memeriksa merek kamera, model, waktu pengambilan, tag perangkat lunak, dan koordinat GPS pada gambar JPEG, PNG, dan WebP.",
    },
    body: {
      en: [
        "Every smartphone and digital camera embeds EXIF tags inside photos by default unless location or metadata sharing is disabled. Viewing these tags helps photographers verify exposure settings and helps privacy-conscious users check whether a photo contains home GPS coordinates before posting.",
        "In JPEG files, EXIF data lives inside the APP1 (0xFFE1) marker as a TIFF-formatted header containing IFD0 (device info), ExifIFD (capture settings), and GPSIFD (location coordinates). PNG files store EXIF in an eXIf chunk, while WebP files store it inside an EXIF RIFF chunk.",
        "With JingleStudio's Image EXIF Viewer, your browser parses these binary structures locally. GPS coordinates remain masked by default so you can inspect files on a shared screen without exposing sensitive locations, and you can export the full tag table as JSON.",
      ],
      id: [
        "Setiap ponsel cerdas dan kamera digital menyematkan tag EXIF di dalam foto secara default. Melihat tag ini membantu fotografer memverifikasi pengaturan eksposur dan memeriksa apakah foto berisi koordinat GPS sebelum dipublikasikan.",
        "Pada file JPEG, data EXIF berada di dalam penanda APP1 (0xFFE1). File PNG menyimpan EXIF di dalam chunk eXIf, sedangkan WebP menyimpannya di dalam chunk RIFF EXIF.",
        "Dengan Image EXIF Viewer JingleStudio, browser Anda mengurai struktur biner ini secara lokal dan menyembunyikan koordinat GPS secara default demi privasi.",
      ],
    },
    sources: [
      { label: "W3C PNG eXIf Chunk Specification", url: "https://www.w3.org/TR/png-3/#11eXIf" },
      { label: "Google WebP Container Specification", url: "https://developers.google.com/speed/webp/docs/riff_container" },
    ],
    publishedAt: "2026-11-20",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "Image EXIF Viewer", href: "/tools/exif-viewer" },
      { title: "Privacy Metadata Cleaner", href: "/tools/privacy-metadata-cleaner" },
    ],
    aeoQuestions: [
      {
        q: "How do I check if a photo has GPS coordinates embedded?",
        a: "Open the photo in JingleStudio's Image EXIF Viewer. The GPS Coordinates card immediately reports whether location data is Detected or Not detected, and lets you toggle the decimal latitude and longitude.",
      },
      {
        q: "Why does an image downloaded from social media have no EXIF data?",
        a: "Most social networks (including Instagram, X, and Facebook) strip EXIF and GPS headers when re-encoding uploaded images for delivery.",
      },
    ],
  },
  {
    slug: "how-to-inspect-video-metadata",
    title: {
      en: "How to Inspect Video Metadata Online (MP4, MOV & WebM Streams)",
      id: "Cara Memeriksa Metadata Video Secara Online (Aliran MP4, MOV & WebM)",
    },
    summary: {
      en: "Learn how video containers store codec profiles, resolution, frame rate, overall bitrate, audio stream parameters, and C2PA provenance.",
      id: "Pelajari cara kontainer video menyimpan profil codec, resolusi, frame rate, bitrate, parameter audio, dan provenans C2PA.",
    },
    body: {
      en: [
        "Video files such as MP4, QuickTime MOV, and WebM are multimedia containers that bundle compressed video tracks, audio streams, timing tables, and descriptive metadata atoms into a single file.",
        "In ISO Base Media File Format (MP4 and MOV) containers, the ftyp box identifies the container brand, the moov/mvhd box stores overall timescale and duration, and each trak/mdia/minf/stbl/stsd hierarchy declares the video codec (such as avc1/H.264, hvc1/HEVC, or av01/AV1) and audio stream parameters (such as mp4a/AAC channel count and sample rate in Hz). WebM files use Matroska EBML elements for Info and Tracks.",
        "JingleStudio's Video Metadata Inspector reads these container boxes directly in your browser and clearly distinguishes container-level header inspection from full frame-by-frame bitstream decoding.",
      ],
      id: [
        "File video seperti MP4, QuickTime MOV, dan WebM adalah kontainer multimedia yang menggabungkan trek video, aliran audio, tabel waktu, dan metadata deskriptif.",
        "Pada kontainer ISO-BMFF (MP4 dan MOV), kotak ftyp mengidentifikasi merek kontainer, moov/mvhd menyimpan durasi, dan stsd mendeklarasikan codec video serta parameter audio. File WebM menggunakan elemen EBML Matroska.",
        "Video Metadata Inspector JingleStudio membaca kotak kontainer ini secara langsung di browser Anda tanpa mengunggah file video.",
      ],
    },
    sources: [
      { label: "ISO/IEC 14496-12 ISO Base Media File Format", url: "https://www.iso.org/standard/83102.html" },
      { label: "WebM Container Guidelines", url: "https://www.webmproject.org/docs/container/" },
    ],
    publishedAt: "2026-11-20",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "Video Metadata Inspector", href: "/tools/video-metadata-inspector" },
      { title: "YouTube AI Label Check", href: "/tools/youtube-ai-label-check" },
      { title: "TikTok AI Label Check", href: "/tools/tiktok-ai-label-check" },
    ],
    aeoQuestions: [
      {
        q: "How can I check a video's codec, resolution, and audio sample rate online?",
        a: "Select your MP4, MOV, or WebM file in the Video Metadata Inspector. It extracts the container brand, video codec, dimensions, duration, overall kbps bitrate, and audio codec/channels/sample rate locally.",
      },
    ],
  },
  {
    slug: "image-compression-and-resizing-explained",
    title: {
      en: "Image Compression & Resizing Explained: Quality, Formats & Dimensions",
      id: "Penjelasan Kompresi & Pengubahan Ukuran Gambar: Kualitas, Format & Dimensi",
    },
    summary: {
      en: "How lossy vs. lossless compression, WebP/JPEG/PNG format selection, and aspect-ratio locked resizing affect visual quality and page speed.",
      id: "Bagaimana kompresi lossy vs. lossless, pemilihan format WebP/JPEG/PNG, dan pengubahan ukuran memengaruhi kualitas visual.",
    },
    body: {
      en: [
        "Optimizing image dimensions and byte size improves website Core Web Vitals—especially Largest Contentful Paint (LCP)—and speeds up sharing across social platforms and messaging apps.",
        "Resizing changes the actual pixel grid (width × height). If an image is displayed at 800×600 pixels on a page, serving a 4000×3000 camera original wastes over 90% of the transmitted pixels. Locking the aspect ratio ensures width and height scale proportionally without distortion.",
        "Compression reduces the number of bytes required to store those pixels. PNG uses lossless DEFLATE compression ideal for sharp UI graphics, while JPEG and WebP offer adjustable quality sliders (typically 75–85% for web delivery) that substantially reduce byte size. Keep in mind that client-side Canvas re-encoding creates a clean derivative image without the original container's EXIF or C2PA manifest.",
      ],
      id: [
        "Mengoptimalkan dimensi dan ukuran byte gambar meningkatkan Core Web Vitals situs web—terutama Largest Contentful Paint (LCP).",
        "Pengubahan ukuran (resizing) mengubah kisi piksel aktual (lebar × tinggi). Mengunci rasio aspek memastikan lebar dan tinggi berubah secara proporsional tanpa distorsi.",
        "Kompresi mengurangi jumlah byte yang diperlukan untuk menyimpan piksel tersebut menggunakan PNG lossless atau JPEG/WebP dengan pengatur kualitas.",
      ],
    },
    sources: [
      { label: "Web.dev — Serve Responsive Images", url: "https://web.dev/articles/serve-responsive-images" },
      { label: "MDN — Image File Type and Format Guide", url: "https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types" },
    ],
    publishedAt: "2026-11-20",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "Image Compression Tool", href: "/tools/image-compressor" },
      { title: "Image Resizer", href: "/tools/image-resizer" },
      { title: "Image Format Converter", href: "/tools/image-converter" },
    ],
    aeoQuestions: [
      {
        q: "What is the best quality setting for JPEG and WebP compression?",
        a: "A quality setting between 75% and 85% typically achieves a 50–75% file size reduction while preserving high visual fidelity for web and social media use.",
      },
    ],
  },
  {
    slug: "understanding-digital-media-provenance",
    title: {
      en: "Understanding Digital Media Provenance & File Integrity (SHA-256 & C2PA)",
      id: "Memahami Provenans Media Digital & Integritas File (SHA-256 & C2PA)",
    },
    summary: {
      en: "How cryptographic SHA-256 digests, magic-byte header validation, and C2PA manifests work together to verify media authenticity.",
      id: "Bagaimana hash SHA-256 kriptografis, validasi header magic-byte, dan manifes C2PA bekerja bersama untuk memverifikasi keaslian media.",
    },
    body: {
      en: [
        "Digital media integrity and provenance answer two distinct questions: 'Are these exact file bytes intact and well-formed?' (integrity) and 'Who created or modified this asset?' (provenance).",
        "File integrity starts with magic-byte validation—verifying that the leading bytes match the claimed container specification—followed by structural chunk verification, polyglot screening, and a cryptographic SHA-256 checksum. Changing even a single bit in a file produces a completely different 64-character SHA-256 digest.",
        "C2PA Content Credentials build on cryptographic hashing by signing the asset's hard bindings (content hashes) together with claim assertions using a private key issued by a certificate authority.",
      ],
      id: [
        "Integritas dan provenans media digital menjawab dua pertanyaan berbeda: apakah byte file utuh (integritas) dan siapa yang membuat atau memodifikasi aset tersebut (provenans).",
        "Integritas file dimulai dengan validasi magic-byte, pemeriksaan struktur kontainer, dan checksum kriptografis SHA-256.",
        "Kredensial Konten C2PA menandatangani hash konten bersama pernyataan klaim menggunakan kunci kriptografis.",
      ],
    },
    sources: [
      { label: "NIST FIPS 180-4 Secure Hash Standard (SHA-256)", url: "https://csrc.nist.gov/publications/detail/fips/180/4/final" },
      { label: "C2PA Explainer", url: "https://c2pa.org/post/c2pa-explainer/" },
    ],
    publishedAt: "2026-11-20",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "File Integrity Checker", href: "/tools/file-integrity-checker" },
      { title: "Media Inspection Report Generator", href: "/tools/report-generator" },
      { title: "C2PA Credential Verifier", href: "/tools/content-credentials-check" },
    ],
    aeoQuestions: [
      {
        q: "How does a SHA-256 checksum prove a file has not been altered?",
        a: "SHA-256 is a one-way cryptographic hash function. If two files produce the exact same 64-character SHA-256 hex string, their binary contents are identical byte-for-byte.",
      },
    ],
  },
  {
    slug: "how-to-protect-personal-information-in-image-metadata",
    title: {
      en: "How to Protect Personal Information in Image & Video Metadata",
      id: "Cara Melindungi Informasi Pribadi dalam Metadata Gambar & Video",
    },
    summary: {
      en: "How to inspect and selectively remove GPS coordinates, camera serial numbers, and personal EXIF tags while preserving C2PA Content Credentials.",
      id: "Cara memeriksa dan menghapus koordinat GPS, nomor seri kamera, dan tag EXIF pribadi secara selektif sambil mempertahankan Kredensial Konten C2PA.",
    },
    body: {
      en: [
        "Photos and videos shot on phones or cameras frequently contain precise GPS latitude, longitude, altitude, capture timestamps, device serial numbers, and owner names inside EXIF, XMP, or QuickTime udta metadata.",
        "When sharing original files via email, cloud drives, or property portals that do not strip metadata, those personal tags travel with the file. Inspecting your media first lets you see exactly which personal fields are present.",
        "JingleStudio's Privacy Metadata Cleaner lets you confirm and remove personal EXIF, GPS, and device tags into a separate cleaned copy while keeping embedded C2PA Content Credentials intact—protecting your personal privacy without misrepresenting AI provenance.",
      ],
      id: [
        "Foto dan video yang diambil dengan ponsel atau kamera sering kali berisi koordinat GPS yang presisi, waktu pengambilan, dan nomor seri perangkat di dalam metadata EXIF, XMP, atau QuickTime.",
        "Memeriksa media terlebih dahulu memungkinkan Anda melihat bidang pribadi mana yang ada sebelum membagikan file asli.",
        "Privacy Metadata Cleaner JingleStudio menghapus tag EXIF dan GPS pribadi ke dalam salinan terpisah yang bersih sambil menjaga Kredensial Konten C2PA tetap utuh.",
      ],
    },
    sources: [
      { label: "C2PA Guidance on Privacy and Metadata", url: "https://spec.c2pa.org/specifications/specifications/2.3/guidance/Guidance.html" },
    ],
    publishedAt: "2026-11-20",
    updatedAt: "2026-11-20",
    relatedTools: [
      { title: "Privacy Metadata Cleaner", href: "/tools/privacy-metadata-cleaner" },
      { title: "Image EXIF Viewer", href: "/tools/exif-viewer" },
      { title: "Media Metadata Inspector", href: "/tools/media-metadata-inspector" },
    ],
    aeoQuestions: [
      {
        q: "Can I remove GPS location data from a photo without losing image quality?",
        a: "Yes. Container-level privacy metadata cleaning strips EXIF and GPS segments while preserving the image's pixel dimensions, visual quality, and C2PA Content Credentials.",
      },
    ],
  },
];
