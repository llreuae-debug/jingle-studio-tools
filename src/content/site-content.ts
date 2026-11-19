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
  },
];
