export type PlacementId =
  | "instagram-post"
  | "instagram-story"
  | "instagram-reels"
  | "tiktok-ai"
  | "content-credentials";

export interface PlacementSpec {
  id: PlacementId;
  route: string;
  title: { en: string; id: string };
  subtitle: { en: string; id: string };
  platformName: string;
  lastChecked: string;
  acceptedMimePrefixes: string[];
  acceptedExtensions: string[];
  recommendedFormatsLabel: string;
  minWidth?: number;
  maxWidth?: number;
  aspectRatioRange?: { min: number; max: number; label: string };
  maxFileSizeMb: number;
  maxDurationSec?: number;
  recommendedCaption: { en: string; id: string };
  platformSteps: { en: string[]; id: string[] };
  officialHelpUrl: string;
  officialHelpLabel: { en: string; id: string };
}

export const PLACEMENT_SPECS: Record<PlacementId, PlacementSpec> = {
  "instagram-post": {
    id: "instagram-post",
    route: "/tools/instagram-post-check",
    title: {
      en: "Instagram Post Check",
      id: "Pemeriksaan Postingan Instagram",
    },
    subtitle: {
      en: "Check C2PA Content Credentials, AI signals, and feed post format fit locally in your browser.",
      id: "Periksa Kredensial Konten C2PA, sinyal AI, dan kesesuaian format feed secara lokal di browser.",
    },
    platformName: "Instagram",
    lastChecked: "2026-11-19",
    acceptedMimePrefixes: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".mp4"],
    recommendedFormatsLabel: "JPEG, PNG, WebP, MP4",
    minWidth: 320,
    maxWidth: 1440,
    aspectRatioRange: { min: 0.8, max: 1.91, label: "4:5 (0.8) to 1.91:1" },
    maxFileSizeMb: 30,
    maxDurationSec: 60,
    recommendedCaption: {
      en: "Disclosure: Created or edited using AI-assisted tools. Original concept and review by our team.",
      id: "Pengungkapan: Dibuat atau diedit menggunakan alat bantu AI. Konsep asli dan tinjauan oleh tim kami.",
    },
    platformSteps: {
      en: [
        "Open Instagram and select your photo or video for a Feed Post.",
        "On the final caption/share screen, scroll down and tap 'More options' or 'Advanced settings'.",
        "Toggle on 'Add AI label' when the media is photorealistic AI-generated or substantially AI-edited.",
      ],
      id: [
        "Buka Instagram dan pilih foto atau video Anda untuk Postingan Feed.",
        "Di layar takarir/bagikan terakhir, gulir ke bawah dan ketuk 'Opsi lainnya' atau 'Pengaturan lanjutan'.",
        "Aktifkan 'Tambahkan label AI' jika media dihasilkan AI secara fotorealistis atau diedit AI secara substansial.",
      ],
    },
    officialHelpUrl: "https://help.instagram.com/754107866669271",
    officialHelpLabel: {
      en: "Instagram AI Info & Label Help Center",
      id: "Pusat Bantuan Info & Label AI Instagram",
    },
  },
  "instagram-story": {
    id: "instagram-story",
    route: "/tools/instagram-story-check",
    title: {
      en: "Instagram Story Check",
      id: "Pemeriksaan Story Instagram",
    },
    subtitle: {
      en: "Inspect Content Credentials and 9:16 Story format fit without uploading your file.",
      id: "Periksa Kredensial Konten dan kesesuaian format Story 9:16 tanpa mengunggah file Anda.",
    },
    platformName: "Instagram",
    lastChecked: "2026-11-19",
    acceptedMimePrefixes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"],
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov"],
    recommendedFormatsLabel: "JPEG, PNG, MP4, MOV",
    minWidth: 540,
    aspectRatioRange: { min: 0.5, max: 0.65, label: "9:16 (0.5625) recommended" },
    maxFileSizeMb: 30,
    maxDurationSec: 60,
    recommendedCaption: {
      en: "AI disclosure: Visuals include AI-generated or AI-enhanced elements.",
      id: "Pengungkapan AI: Visual mencakup elemen yang dibuat atau ditingkatkan AI.",
    },
    platformSteps: {
      en: [
        "Upload your Story media in the Instagram app.",
        "Tap the three-dot menu or sticker/AI label control before sharing if your account shows the AI disclosure toggle.",
        "Alternatively, include a clear visible text disclosure sticker on the Story frame.",
      ],
      id: [
        "Unggah media Story Anda di aplikasi Instagram.",
        "Ketuk menu tiga titik atau kontrol label AI sebelum membagikan jika akun Anda menampilkan tombol pengungkapan AI.",
        "Atau, sertakan stiker teks pengungkapan yang jelas pada bingkai Story.",
      ],
    },
    officialHelpUrl: "https://help.instagram.com/754107866669271",
    officialHelpLabel: {
      en: "Instagram AI Info & Label Help Center",
      id: "Pusat Bantuan Info & Label AI Instagram",
    },
  },
  "instagram-reels": {
    id: "instagram-reels",
    route: "/tools/instagram-reels-check",
    title: {
      en: "Instagram Reels Check",
      id: "Pemeriksaan Reels Instagram",
    },
    subtitle: {
      en: "Check video Content Credentials, AI signals, and Reels 9:16 duration & size fit.",
      id: "Periksa Kredensial Konten video, sinyal AI, serta durasi & ukuran Reels 9:16.",
    },
    platformName: "Instagram",
    lastChecked: "2026-11-19",
    acceptedMimePrefixes: ["video/mp4", "video/quicktime"],
    acceptedExtensions: [".mp4", ".mov"],
    recommendedFormatsLabel: "MP4, MOV",
    minWidth: 540,
    aspectRatioRange: { min: 0.5, max: 0.65, label: "9:16 (0.5625) recommended" },
    maxFileSizeMb: 100,
    maxDurationSec: 180,
    recommendedCaption: {
      en: "Disclosure: This Reel includes AI-generated or AI-edited video/audio elements.",
      id: "Pengungkapan: Reel ini mencakup elemen video/audio yang dibuat atau diedit AI.",
    },
    platformSteps: {
      en: [
        "Select your Reel clip in Instagram and proceed to the Share screen.",
        "Tap 'More options' at the bottom of the Share screen.",
        "Enable 'Add AI label' if your Reel contains realistic AI-generated scenes or voices.",
      ],
      id: [
        "Pilih klip Reel Anda di Instagram dan lanjutkan ke layar Bagikan.",
        "Ketuk 'Opsi lainnya' di bagian bawah layar Bagikan.",
        "Aktifkan 'Tambahkan label AI' jika Reel Anda berisi adegan atau suara realistis yang dihasilkan AI.",
      ],
    },
    officialHelpUrl: "https://help.instagram.com/754107866669271",
    officialHelpLabel: {
      en: "Instagram AI Info & Label Help Center",
      id: "Pusat Bantuan Info & Label AI Instagram",
    },
  },
  "tiktok-ai": {
    id: "tiktok-ai",
    route: "/tools/tiktok-ai-label-check",
    title: {
      en: "TikTok AI Label Check",
      id: "Pemeriksaan Label AI TikTok",
    },
    subtitle: {
      en: "Inspect C2PA credentials and AI signals before posting, plus TikTok disclosure steps.",
      id: "Periksa kredensial C2PA dan sinyal AI sebelum memposting, beserta langkah pengungkapan TikTok.",
    },
    platformName: "TikTok",
    lastChecked: "2026-11-19",
    acceptedMimePrefixes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"],
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov"],
    recommendedFormatsLabel: "MP4, MOV, JPEG, PNG, WebP",
    minWidth: 540,
    aspectRatioRange: { min: 0.5, max: 0.65, label: "9:16 (0.5625) recommended" },
    maxFileSizeMb: 287,
    maxDurationSec: 600,
    recommendedCaption: {
      en: "AI-generated / AI-edited content disclosure. Created with AI tools.",
      id: "Pengungkapan konten yang dibuat / diedit AI. Dibuat dengan alat AI.",
    },
    platformSteps: {
      en: [
        "In the TikTok app, upload your video or photo and go to the Post screen.",
        "Tap 'More options' below the caption box.",
        "Turn on 'AI-generated content' when your post contains realistic AI-generated or substantially edited media.",
      ],
      id: [
        "Di aplikasi TikTok, unggah video atau foto Anda dan buka layar Posting.",
        "Ketuk 'Opsi lainnya' di bawah kotak takarir.",
        "Aktifkan 'Konten yang dibuat AI' saat postingan Anda berisi media realistis yang dihasilkan atau diedit AI.",
      ],
    },
    officialHelpUrl: "https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content",
    officialHelpLabel: {
      en: "TikTok AI-Generated Content Policy & Help",
      id: "Kebijakan & Bantuan Konten Buatan AI TikTok",
    },
  },
  "content-credentials": {
    id: "content-credentials",
    route: "/tools/content-credentials-check",
    title: {
      en: "Content Credentials Check",
      id: "Pemeriksaan Kredensial Konten",
    },
    subtitle: {
      en: "Inspect C2PA manifests, signer trust, ingredient history, and AI disclosures locally.",
      id: "Periksa manifes C2PA, kepercayaan penanda tangan, riwayat bahan, dan pengungkapan AI secara lokal.",
    },
    platformName: "General C2PA",
    lastChecked: "2026-11-19",
    acceptedMimePrefixes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/tiff",
      "image/svg+xml",
      "video/mp4",
      "video/quicktime",
      "application/pdf",
    ],
    acceptedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".avif",
      ".tiff",
      ".svg",
      ".mp4",
      ".mov",
      ".pdf",
    ],
    recommendedFormatsLabel: "JPEG, PNG, WebP, AVIF, TIFF, SVG, MP4, MOV, PDF",
    maxFileSizeMb: 500,
    recommendedCaption: {
      en: "Provenance checked with C2PA Content Credentials.",
      id: "Asal media diperiksa dengan Kredensial Konten C2PA.",
    },
    platformSteps: {
      en: [
        "Drop any supported image, video, or PDF into the checker above.",
        "Review the signer certificate, ingredient tree, and self-declared AI disclosure.",
      ],
      id: [
        "Letakkan gambar, video, atau PDF yang didukung ke dalam pemeriksa di atas.",
        "Tinjau sertifikat penanda tangan, pohon bahan, dan pengungkapan AI yang dideklarasikan sendiri.",
      ],
    },
    officialHelpUrl: "https://opensource.contentauthenticity.org/docs/verify",
    officialHelpLabel: {
      en: "C2PA Content Credentials Documentation",
      id: "Dokumentasi Kredensial Konten C2PA",
    },
  },
};
