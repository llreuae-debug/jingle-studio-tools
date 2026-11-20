export type PlacementId =
  | "instagram-post"
  | "instagram-story"
  | "instagram-reels"
  | "tiktok-ai"
  | "youtube-ai"
  | "facebook-ai"
  | "x-ai"
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
  "youtube-ai": {
    id: "youtube-ai",
    route: "/tools/youtube-ai-label-check",
    title: {
      en: "YouTube AI Label Check",
      id: "Pemeriksaan Label AI YouTube",
    },
    subtitle: {
      en: "Verify C2PA credentials, video format fit, and YouTube Studio altered or synthetic content disclosure steps.",
      id: "Verifikasi kredensial C2PA, kesesuaian format video, dan langkah pengungkapan konten sintetis YouTube Studio.",
    },
    platformName: "YouTube",
    lastChecked: "2026-11-20",
    acceptedMimePrefixes: ["video/mp4", "video/quicktime", "video/webm", "image/jpeg", "image/png"],
    acceptedExtensions: [".mp4", ".mov", ".webm", ".jpg", ".jpeg", ".png"],
    recommendedFormatsLabel: "MP4, MOV, WebM (16:9 or 9:16 Shorts)",
    minWidth: 640,
    aspectRatioRange: { min: 0.56, max: 1.78, label: "9:16 Shorts to 16:9 HD" },
    maxFileSizeMb: 512,
    recommendedCaption: {
      en: "Disclosure: This video includes altered or synthetic content created with AI tools.",
      id: "Pengungkapan: Video ini berisi konten yang diubah atau sintetis yang dibuat dengan alat AI.",
    },
    platformSteps: {
      en: [
        "Upload your video or Short in YouTube Studio and open the 'Details' step.",
        "Scroll down and expand 'Show more', then locate the 'Altered content' section.",
        "Select 'Yes' if the video contains realistic altered or synthetic people, places, or events.",
      ],
      id: [
        "Unggah video atau Short Anda di YouTube Studio dan buka langkah 'Detail'.",
        "Gulir ke bawah dan perluas 'Tampilkan lebih banyak', lalu temukan bagian 'Konten yang diubah'.",
        "Pilih 'Ya' jika video berisi orang, tempat, atau peristiwa sintetis/diubah yang realistis.",
      ],
    },
    officialHelpUrl: "https://support.google.com/youtube/answer/14328491",
    officialHelpLabel: {
      en: "YouTube Altered or Synthetic Content Help",
      id: "Bantuan Konten Sintetis atau Diubah YouTube",
    },
  },
  "facebook-ai": {
    id: "facebook-ai",
    route: "/tools/facebook-ai-label-check",
    title: {
      en: "Facebook AI Label Check",
      id: "Pemeriksaan Label AI Facebook",
    },
    subtitle: {
      en: "Inspect C2PA Content Credentials and Meta AI Info label readiness for Facebook posts and Reels.",
      id: "Periksa Kredensial Konten C2PA dan kesiapan label Info AI Meta untuk postingan dan Reels Facebook.",
    },
    platformName: "Facebook",
    lastChecked: "2026-11-20",
    acceptedMimePrefixes: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".mp4"],
    recommendedFormatsLabel: "JPEG, PNG, WebP, MP4",
    minWidth: 320,
    maxWidth: 2048,
    aspectRatioRange: { min: 0.56, max: 1.91, label: "9:16 Reels to 1.91:1 Feed" },
    maxFileSizeMb: 100,
    recommendedCaption: {
      en: "AI Info: Created or edited using AI-assisted tools.",
      id: "Info AI: Dibuat atau diedit menggunakan alat bantu AI.",
    },
    platformSteps: {
      en: [
        "Create a Facebook post or Reel and attach your image or video.",
        "Open the post options or audience/more settings menu before publishing.",
        "Enable the Meta 'Add AI label' toggle when sharing photorealistic AI-generated or AI-edited visuals.",
      ],
      id: [
        "Buat postingan atau Reel Facebook dan lampirkan gambar atau video Anda.",
        "Buka opsi postingan atau menu pengaturan lainnya sebelum menerbitkan.",
        "Aktifkan tombol 'Tambahkan label AI' Meta saat membagikan visual fotorealistis buatan atau editan AI.",
      ],
    },
    officialHelpUrl: "https://www.facebook.com/help/1133375301371235",
    officialHelpLabel: {
      en: "Facebook & Meta AI Info Label Help",
      id: "Bantuan Label Info AI Facebook & Meta",
    },
  },
  "x-ai": {
    id: "x-ai",
    route: "/tools/x-ai-label-check",
    title: {
      en: "X (Twitter) AI Label Check",
      id: "Pemeriksaan Label AI X (Twitter)",
    },
    subtitle: {
      en: "Check C2PA Content Credentials, aspect ratio fit, and synthetic media disclosure best practices for X.",
      id: "Periksa Kredensial Konten C2PA, rasio aspek, dan praktik pengungkapan media sintetis untuk X.",
    },
    platformName: "X",
    lastChecked: "2026-11-20",
    acceptedMimePrefixes: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".mp4"],
    recommendedFormatsLabel: "JPEG, PNG, WebP, MP4",
    minWidth: 320,
    aspectRatioRange: { min: 0.5, max: 2.0, label: "1:2 vertical to 2:1 landscape" },
    maxFileSizeMb: 512,
    maxDurationSec: 140,
    recommendedCaption: {
      en: "Note: Image/video generated or edited with AI tools.",
      id: "Catatan: Gambar/video dibuat atau diedit dengan alat AI.",
    },
    platformSteps: {
      en: [
        "Attach your media in the X post composer and inspect C2PA credentials before publishing.",
        "Include clear AI disclosure context in your post text or alt text when sharing synthetic media.",
        "Avoid stripping C2PA provenance so community and platform verification systems can read the origin chain.",
      ],
      id: [
        "Lampirkan media Anda di komposer postingan X dan periksa kredensial C2PA sebelum menerbitkan.",
        "Sertakan konteks pengungkapan AI yang jelas di teks postingan atau teks alt saat membagikan media sintetis.",
        "Hindari menghapus provenans C2PA agar sistem verifikasi komunitas dan platform dapat membaca rantai asal.",
      ],
    },
    officialHelpUrl: "https://help.x.com/en/rules-and-policies/manipulated-media",
    officialHelpLabel: {
      en: "X Synthetic & Manipulated Media Policy",
      id: "Kebijakan Media Sintetis & Dimanipulasi X",
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
    officialHelpUrl: "https://opensource.contentauthenticity.org/docs/",
    officialHelpLabel: {
      en: "C2PA Content Credentials Documentation",
      id: "Dokumentasi Kredensial Konten C2PA",
    },
  },
};
