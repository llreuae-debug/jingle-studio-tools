import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SITE_CONFIG } from "../src/config/site";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const BRAND_DIR = path.join(PUBLIC_DIR, "brand");

const PLUM = "#3F113D";
const LIME = "#B9D175";
const CREAM = "#F6FBDD";
const MINT = "#DDEEC2";

function markSvg(opts: {
  tileFill?: string | null;
  glyphFill: string;
  lensCenterFill: string;
  title?: string;
}): string {
  const { tileFill = PLUM, glyphFill, lensCenterFill, title = "Jingle Studio Mark" } = opts;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${title}">
  <title>${title}</title>
  ${tileFill ? `<rect x="0" y="0" width="512" height="512" rx="112" fill="${tileFill}"/>` : ""}
  <circle cx="276" cy="114" r="40" fill="${glyphFill}"/>
  <circle cx="276" cy="114" r="21" fill="${lensCenterFill}"/>
  <path d="M 276 204 L 276 340 C 276 392 238 416 196 404" fill="none" stroke="${glyphFill}" stroke-width="74" stroke-linecap="round"/>
</svg>
`;
}

function smallFaviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="${SITE_CONFIG.name}">
  <title>${SITE_CONFIG.name}</title>
  <rect x="0" y="0" width="32" height="32" rx="7" fill="${PLUM}"/>
  <circle cx="18" cy="7" r="3.2" fill="${LIME}"/>
  <circle cx="18" cy="7" r="1.4" fill="${CREAM}"/>
  <path d="M 18 13 L 18 22 C 18 26 14 27 11 25" fill="none" stroke="${LIME}" stroke-width="5.6" stroke-linecap="round"/>
</svg>
`;
}

function safariPinnedTabSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>${SITE_CONFIG.name}</title>
  <circle cx="276" cy="114" r="42" fill="#000000"/>
  <path d="M 276 204 L 276 340 C 276 392 238 416 196 404" fill="none" stroke="#000000" stroke-width="76" stroke-linecap="round"/>
</svg>
`;
}

function horizontalLockupSvg(theme: "plum" | "cream"): string {
  const textFill = theme === "plum" ? PLUM : CREAM;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 112" role="img" aria-label="${SITE_CONFIG.name}">
  <title>${SITE_CONFIG.name}</title>
  <g transform="translate(8,8) scale(0.1875)">
    <rect x="0" y="0" width="512" height="512" rx="112" fill="${PLUM}"/>
    <circle cx="276" cy="114" r="40" fill="${LIME}"/>
    <circle cx="276" cy="114" r="21" fill="${CREAM}"/>
    <path d="M 276 204 L 276 340 C 276 392 238 416 196 404" fill="none" stroke="${LIME}" stroke-width="74" stroke-linecap="round"/>
  </g>
  <text x="124" y="69" fill="${textFill}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="44" font-weight="600" letter-spacing="-1.2">Jingle Studio</text>
</svg>
`;
}

function stackedLockupSvg(theme: "plum" | "cream"): string {
  const textFill = theme === "plum" ? PLUM : CREAM;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="${SITE_CONFIG.name}">
  <title>${SITE_CONFIG.name}</title>
  <g transform="translate(100,16) scale(0.234375)">
    <rect x="0" y="0" width="512" height="512" rx="112" fill="${PLUM}"/>
    <circle cx="276" cy="114" r="40" fill="${LIME}"/>
    <circle cx="276" cy="114" r="21" fill="${CREAM}"/>
    <path d="M 276 204 L 276 340 C 276 392 238 416 196 404" fill="none" stroke="${LIME}" stroke-width="74" stroke-linecap="round"/>
  </g>
  <text x="160" y="186" text-anchor="middle" fill="${textFill}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="36" font-weight="600" letter-spacing="-1">Jingle Studio</text>
</svg>
`;
}

function maskableSvg(): string {
  // Glyph scaled inside central 80% safe zone on solid plum background (no rounded corners)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>${SITE_CONFIG.name}</title>
  <rect x="0" y="0" width="512" height="512" fill="${PLUM}"/>
  <g transform="translate(82,82) scale(0.68)">
    <circle cx="276" cy="114" r="40" fill="${LIME}"/>
    <circle cx="276" cy="114" r="21" fill="${CREAM}"/>
    <path d="M 276 204 L 276 340 C 276 392 238 416 196 404" fill="none" stroke="${LIME}" stroke-width="74" stroke-linecap="round"/>
  </g>
</svg>
`;
}

function ogBannerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect x="0" y="0" width="1200" height="630" fill="${PLUM}"/>
  <rect x="64" y="64" width="1072" height="502" rx="36" fill="#4D194A"/>
  <g transform="translate(110,120) scale(0.22)">
    <rect x="0" y="0" width="512" height="512" rx="112" fill="${LIME}"/>
    <circle cx="276" cy="114" r="40" fill="${PLUM}"/>
    <circle cx="276" cy="114" r="21" fill="${CREAM}"/>
    <path d="M 276 204 L 276 340 C 276 392 238 416 196 404" fill="none" stroke="${PLUM}" stroke-width="74" stroke-linecap="round"/>
  </g>
  <text x="245" y="190" fill="${CREAM}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="38" font-weight="600">Jingle Studio Tools</text>
  <text x="110" y="315" fill="${CREAM}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="56" font-weight="700">Know what your file says</text>
  <text x="110" y="385" fill="${LIME}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="56" font-weight="700">before you post it.</text>
  <text x="110" y="465" fill="${MINT}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="26">C2PA Content Credentials • Honest AI Disclosure • Proof Pages</text>
</svg>
`;
}

function encodePngIco(entries: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(entries.length * 16);
  let offset = 6 + dir.length;

  entries.forEach((entry, idx) => {
    const pos = idx * 16;
    const dim = entry.size >= 256 ? 0 : entry.size;
    dir.writeUInt8(dim, pos);
    dir.writeUInt8(dim, pos + 1);
    dir.writeUInt8(0, pos + 2); // palette
    dir.writeUInt8(0, pos + 3); // reserved
    dir.writeUInt16LE(1, pos + 4); // planes
    dir.writeUInt16LE(32, pos + 6); // bpp
    dir.writeUInt32LE(entry.png.length, pos + 8);
    dir.writeUInt32LE(offset, pos + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

async function main() {
  await fs.mkdir(BRAND_DIR, { recursive: true });

  // 1. Write SVG sources
  const svgs: Record<string, string> = {
    "brand/mark.svg": markSvg({ tileFill: PLUM, glyphFill: LIME, lensCenterFill: CREAM }),
    "brand/mark-transparent.svg": markSvg({
      tileFill: null,
      glyphFill: LIME,
      lensCenterFill: CREAM,
    }),
    "brand/mark-mono-plum.svg": markSvg({
      tileFill: null,
      glyphFill: PLUM,
      lensCenterFill: CREAM,
    }),
    "brand/mark-mono-cream.svg": markSvg({
      tileFill: null,
      glyphFill: CREAM,
      lensCenterFill: PLUM,
    }),
    "brand/logo-horizontal-plum.svg": horizontalLockupSvg("plum"),
    "brand/logo-horizontal-cream.svg": horizontalLockupSvg("cream"),
    "brand/logo-stacked-plum.svg": stackedLockupSvg("plum"),
    "brand/logo-stacked-cream.svg": stackedLockupSvg("cream"),
    "favicon.svg": smallFaviconSvg(),
    "safari-pinned-tab.svg": safariPinnedTabSvg(),
  };

  for (const [rel, content] of Object.entries(svgs)) {
    await fs.writeFile(path.join(PUBLIC_DIR, rel), content, "utf8");
  }

  // 2. Render Brand PNGs
  const markBuf = Buffer.from(svgs["brand/mark.svg"]);
  const horizBuf = Buffer.from(svgs["brand/logo-horizontal-plum.svg"]);
  const smallFavBuf = Buffer.from(svgs["favicon.svg"]);
  const maskableBuf = Buffer.from(maskableSvg());

  await Promise.all([
    sharp(horizBuf).resize({ width: 2000 }).png().toFile(path.join(BRAND_DIR, "logo-horizontal.png")),
    sharp(horizBuf).resize({ width: 600 }).png().toFile(path.join(BRAND_DIR, "logo-email.png")),
    sharp(markBuf).resize(512, 512).png().toFile(path.join(BRAND_DIR, "logo-square-512.png")),
    sharp(markBuf).resize(1024, 1024).png().toFile(path.join(BRAND_DIR, "logo-square-1024.png")),
    sharp(markBuf).resize(800, 800).png().toFile(path.join(BRAND_DIR, "social-avatar-800.png")),
    sharp(markBuf).resize(120, 120).png().toFile(path.join(BRAND_DIR, "google-oauth-logo-120.png")),
  ]);

  // 3. Render Browser & Device PNGs + ICO
  const [png16, png32, png48] = await Promise.all([
    sharp(smallFavBuf).resize(16, 16).png().toBuffer(),
    sharp(smallFavBuf).resize(32, 32).png().toBuffer(),
    sharp(markBuf).resize(48, 48).png().toBuffer(),
  ]);

  await Promise.all([
    fs.writeFile(path.join(PUBLIC_DIR, "favicon-16x16.png"), png16),
    fs.writeFile(path.join(PUBLIC_DIR, "favicon-32x32.png"), png32),
    fs.writeFile(path.join(PUBLIC_DIR, "favicon-48x48.png"), png48),
    fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), encodePngIco([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
      { size: 48, png: png48 },
    ])),
    sharp(markBuf).resize(96, 96).png().toFile(path.join(PUBLIC_DIR, "favicon-96x96.png")),
    sharp(maskableBuf).resize(180, 180).flatten({ background: PLUM }).png().toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png")),
    sharp(markBuf).resize(192, 192).png().toFile(path.join(PUBLIC_DIR, "icon-192.png")),
    sharp(markBuf).resize(512, 512).png().toFile(path.join(PUBLIC_DIR, "icon-512.png")),
    sharp(maskableBuf).resize(192, 192).png().toFile(path.join(PUBLIC_DIR, "icon-maskable-192.png")),
    sharp(maskableBuf).resize(512, 512).png().toFile(path.join(PUBLIC_DIR, "icon-maskable-512.png")),
    sharp(maskableBuf).resize(150, 150).png().toFile(path.join(PUBLIC_DIR, "mstile-150x150.png")),
    // Shortcut 96px icons
    sharp(markBuf).resize(96, 96).png().toFile(path.join(PUBLIC_DIR, "shortcut-check-96.png")),
    sharp(markBuf).resize(96, 96).png().toFile(path.join(PUBLIC_DIR, "shortcut-sign-96.png")),
    sharp(markBuf).resize(96, 96).png().toFile(path.join(PUBLIC_DIR, "shortcut-pricing-96.png")),
  ]);

  // 4. OG & Twitter 1200x630 images (<300KB)
  const ogBuf = await sharp(Buffer.from(ogBannerSvg()))
    .resize(1200, 630)
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  await Promise.all([
    fs.writeFile(path.join(PUBLIC_DIR, "og-image.png"), ogBuf),
    fs.writeFile(path.join(PUBLIC_DIR, "twitter-image.png"), ogBuf),
  ]);

  // 5. browserconfig.xml, site.webmanifest, robots.txt
  await fs.writeFile(
    path.join(PUBLIC_DIR, "browserconfig.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/mstile-150x150.png"/>
      <TileColor>${PLUM}</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`,
    "utf8"
  );

  const manifest = {
    id: "/",
    name: SITE_CONFIG.name,
    short_name: SITE_CONFIG.shortName,
    description: SITE_CONFIG.description,
    start_url: "/tools",
    scope: "/",
    display: "standalone",
    theme_color: SITE_CONFIG.themeColor,
    background_color: SITE_CONFIG.backgroundColor,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Check a file",
        short_name: "Check",
        url: "/tools/content-credentials-check",
        icons: [{ src: "/shortcut-check-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Sign your work",
        short_name: "Sign",
        url: "/tools/ai-disclosure-signer",
        icons: [{ src: "/shortcut-sign-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Pricing",
        short_name: "Pricing",
        url: "/pricing",
        icons: [{ src: "/shortcut-pricing-96.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };

  await fs.writeFile(
    path.join(PUBLIC_DIR, "site.webmanifest"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  await fs.writeFile(
    path.join(PUBLIC_DIR, "robots.txt"),
    `User-agent: *
Allow: /
Allow: /favicon.ico
Allow: /favicon.svg
Allow: /brand/
Sitemap: ${SITE_CONFIG.siteUrl}/sitemap.xml
`,
    "utf8"
  );

  console.log("Generated all brand, favicon, manifest, and OG assets successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
