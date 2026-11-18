export type Locale = "en" | "id";

export interface Dictionary {
  nav: {
    tools: string;
    pricing: string;
    dashboard: string;
    signIn: string;
    signOut: string;
    admin: string;
  };
  footer: {
    tagline: string;
    privacy: string;
    terms: string;
    acceptableUse: string;
    localNotice: string;
    disclaimer: string;
  };
  whatsapp: {
    label: string;
  };
  tools: {
    badge: string;
    heroTitle: string;
    heroSubtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    howItWorksTitle: string;
    whatItProvesTitle: string;
    whatItProvesYes: string[];
    whatItProvesNo: string[];
    pricingTitle: string;
    faqTitle: string;
  };
  check: {
    dropTitle: string;
    dropSubtitle: string;
    chooseFile: string;
    reading: string;
    checkAnother: string;
    formatFit: string;
    captionTitle: string;
    copyCaption: string;
    copied: string;
    platformStepsTitle: string;
    labelledByMistakeTitle: string;
    labelledByMistakeIntro: string;
    noSignalsFound: string;
    officialHelpLink: string;
    lastChecked: string;
    cannotProveTitle: string;
    cannotProveBody: string;
  };
  signer: {
    title: string;
    subtitle: string;
    testBanner: string;
    creatorName: string;
    website: string;
    selfDeclaredNote: string;
    aiDisclosureHeading: string;
    modelType: string;
    modelName: string;
    signButton: string;
    downloadSingle: string;
    downloadZip: string;
  };
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    nav: {
      tools: "Tools",
      pricing: "Pricing",
      dashboard: "Dashboard",
      signIn: "Sign in",
      signOut: "Sign out",
      admin: "Admin",
    },
    footer: {
      tagline: "Jingle Studio Tools — Honest Content Credentials & AI Disclosure.",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      acceptableUse: "Acceptable Use",
      localNotice: "Free file checks run in your browser—files never leave your device.",
      disclaimer:
        "Not an AI detector. Missing Content Credentials only means no declaration was found.",
    },
    whatsapp: {
      label: "Chat on WhatsApp",
    },
    tools: {
      badge: "C2PA Content Credentials",
      heroTitle: "Verify provenance and sign honest AI disclosures.",
      heroSubtitle:
        "Inspect Content Credentials locally in your browser for free, check Instagram and TikTok placement fit, or batch-sign your media with C2PA provenance.",
      ctaPrimary: "Open free checker",
      ctaSecondary: "View pricing",
      howItWorksTitle: "How it works",
      whatItProvesTitle: "What Content Credentials can and cannot prove",
      whatItProvesYes: [
        "Who signed the file and when (via cryptographic signature).",
        "Which tools, parent ingredients, and self-declared AI disclosures were attached.",
        "Whether the file was modified after signing (tamper detection).",
      ],
      whatItProvesNo: [
        "It does not prove a file without credentials is human-made or unedited.",
        "It is not an AI detector and cannot detect stripped metadata.",
        "Self-declared author names and AI answers are claims by the signer, not verified identity.",
      ],
      pricingTitle: "Simple credit pricing",
      faqTitle: "Frequently asked questions",
    },
    check: {
      dropTitle: "Drop a file here to inspect",
      dropSubtitle: "Your file stays on your device and is read locally with WebAssembly.",
      chooseFile: "Choose a file",
      reading: "Reading file…",
      checkAnother: "Check another file",
      formatFit: "Placement format fit",
      captionTitle: "Recommended honest disclosure caption",
      copyCaption: "Copy caption",
      copied: "Copied",
      platformStepsTitle: "How to apply the platform AI label",
      labelledByMistakeTitle: "Labelled by mistake?",
      labelledByMistakeIntro:
        "Platforms may apply an AI label based on declared provenance signals in your file. Below are the signals found in this file. We never strip or alter provenance signals.",
      noSignalsFound:
        "No C2PA AI-disclosure or synthetic digitalSourceType signals were found in this file's credentials.",
      officialHelpLink: "Official platform help & appeal page",
      lastChecked: "Specs last checked",
      cannotProveTitle: "What this check cannot prove",
      cannotProveBody:
        "Content Credentials record provenance declared at signing time. Missing credentials only mean no declaration was found—not that a file is human-made or unedited.",
    },
    signer: {
      title: "AI Disclosure Signer",
      subtitle:
        "Sign up to 50 JPG or PNG files with C2PA Content Credentials and an honest AI disclosure.",
      testBanner: "Test signature: other apps will show this signer as unrecognized.",
      creatorName: "Creator or brand name",
      website: "Website (optional)",
      selfDeclaredNote: "Self-declared by the signer",
      aiDisclosureHeading: "How was AI used in these files?",
      modelType: "Model type (required when AI is declared)",
      modelName: "Model name (optional)",
      signButton: "Sign files",
      downloadSingle: "Download",
      downloadZip: "Download all (.zip)",
    },
  },
  id: {
    nav: {
      tools: "Alat",
      pricing: "Harga",
      dashboard: "Dasbor",
      signIn: "Masuk",
      signOut: "Keluar",
      admin: "Admin",
    },
    footer: {
      tagline: "Jingle Studio Tools — Kredensial Konten & Pengungkapan AI yang Jujur.",
      privacy: "Kebijakan Privasi",
      terms: "Ketentuan Layanan",
      acceptableUse: "Penggunaan yang Dapat Diterima",
      localNotice: "Pemeriksaan file gratis berjalan di browser Anda—file tidak meninggalkan perangkat Anda.",
      disclaimer:
        "Bukan pendeteksi AI. Tidak adanya Kredensial Konten hanya berarti tidak ada deklarasi yang ditemukan.",
    },
    whatsapp: {
      label: "Chat di WhatsApp",
    },
    tools: {
      badge: "Kredensial Konten C2PA",
      heroTitle: "Verifikasi asal media dan tandatangani pengungkapan AI yang jujur.",
      heroSubtitle:
        "Periksa Kredensial Konten secara lokal di browser secara gratis, cek kesesuaian format Instagram & TikTok, atau tandatangani batch media dengan C2PA.",
      ctaPrimary: "Buka pemeriksa gratis",
      ctaSecondary: "Lihat harga",
      howItWorksTitle: "Cara kerja",
      whatItProvesTitle: "Apa yang dapat dan tidak dapat dibuktikan oleh Kredensial Konten",
      whatItProvesYes: [
        "Siapa yang menandatangani file dan kapan (melalui tanda tangan kriptografis).",
        "Alat, bahan induk, dan pengungkapan AI yang dideklarasikan sendiri.",
        "Apakah file diubah setelah ditandatangani (deteksi modifikasi).",
      ],
      whatItProvesNo: [
        "Tidak membuktikan bahwa file tanpa kredensial dibuat oleh manusia atau belum diedit.",
        "Bukan pendeteksi AI dan tidak dapat mendeteksi metadata yang telah dihapus.",
        "Nama pembuat dan jawaban AI adalah deklarasi mandiri penanda tangan, bukan identitas terverifikasi.",
      ],
      pricingTitle: "Harga kredit sederhana",
      faqTitle: "Pertanyaan yang sering diajukan",
    },
    check: {
      dropTitle: "Letakkan file di sini untuk diperiksa",
      dropSubtitle: "File Anda tetap di perangkat Anda dan dibaca secara lokal dengan WebAssembly.",
      chooseFile: "Pilih file",
      reading: "Membaca file…",
      checkAnother: "Periksa file lain",
      formatFit: "Kesesuaian format penempatan",
      captionTitle: "Rekomendasi takarir pengungkapan jujur",
      copyCaption: "Salin takarir",
      copied: "Disalin",
      platformStepsTitle: "Cara mengaktifkan label AI platform",
      labelledByMistakeTitle: "Terlabeli secara keliru?",
      labelledByMistakeIntro:
        "Platform dapat menerapkan label AI berdasarkan sinyal asal yang dideklarasikan dalam file Anda. Berikut sinyal yang ditemukan. Kami tidak pernah menghapus atau mengubah sinyal asal.",
      noSignalsFound:
        "Tidak ada sinyal C2PA ai-disclosure atau digitalSourceType sintetis yang ditemukan dalam kredensial file ini.",
      officialHelpLink: "Halaman bantuan & banding resmi platform",
      lastChecked: "Spesifikasi terakhir diperiksa",
      cannotProveTitle: "Apa yang tidak dapat dibuktikan pemeriksaan ini",
      cannotProveBody:
        "Kredensial Konten mencatat asal yang dideklarasikan saat penandatanganan. Kredensial yang hilang hanya berarti tidak ada deklarasi—bukan berarti file dibuat manusia.",
    },
    signer: {
      title: "Penanda Tangan Pengungkapan AI",
      subtitle:
        "Tandatangani hingga 50 file JPG atau PNG dengan Kredensial Konten C2PA dan pengungkapan AI yang jujur.",
      testBanner: "Tanda tangan uji: aplikasi lain akan menampilkan penanda tangan ini sebagai tidak dikenal.",
      creatorName: "Nama kreator atau merek",
      website: "Situs web (opsional)",
      selfDeclaredNote: "Dideklarasikan sendiri oleh penanda tangan",
      aiDisclosureHeading: "Bagaimana AI digunakan dalam file ini?",
      modelType: "Jenis model (wajib jika AI dideklarasikan)",
      modelName: "Nama model (opsional)",
      signButton: "Tandatangani file",
      downloadSingle: "Unduh",
      downloadZip: "Unduh semua (.zip)",
    },
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] || dictionaries.en;
}
