import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderReceiptHtml } from "@/lib/email-templates";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BRAND_DIR = path.join(PUBLIC_DIR, "brand");

describe("Brand, Favicon, Manifest & OG Assets", () => {
  it("generates all required raster icons with exact dimensions", async () => {
    const checks: Array<[string, number, number]> = [
      ["favicon-16x16.png", 16, 16],
      ["favicon-32x32.png", 32, 32],
      ["favicon-48x48.png", 48, 48],
      ["favicon-96x96.png", 96, 96],
      ["apple-touch-icon.png", 180, 180],
      ["icon-192.png", 192, 192],
      ["icon-512.png", 512, 512],
      ["icon-maskable-192.png", 192, 192],
      ["icon-maskable-512.png", 512, 512],
      ["mstile-150x150.png", 150, 150],
      ["shortcut-check-96.png", 96, 96],
      ["shortcut-sign-96.png", 96, 96],
      ["shortcut-pricing-96.png", 96, 96],
      ["og-image.png", 1200, 630],
      ["twitter-image.png", 1200, 630],
    ];

    for (const [rel, w, h] of checks) {
      const meta = await sharp(path.join(PUBLIC_DIR, rel)).metadata();
      expect(meta.width, rel).toBe(w);
      expect(meta.height, rel).toBe(h);
    }

    const appleMeta = await sharp(path.join(PUBLIC_DIR, "apple-touch-icon.png")).metadata();
    expect(appleMeta.hasAlpha).toBe(false);

    const ogStat = await fs.stat(path.join(PUBLIC_DIR, "og-image.png"));
    expect(ogStat.size).toBeLessThan(300 * 1024);

    const brandChecks: Array<[string, number]> = [
      ["logo-horizontal.png", 2000],
      ["logo-email.png", 600],
      ["logo-square-512.png", 512],
      ["logo-square-1024.png", 1024],
      ["social-avatar-800.png", 800],
      ["google-oauth-logo-120.png", 120],
    ];

    for (const [rel, w] of brandChecks) {
      const meta = await sharp(path.join(BRAND_DIR, rel)).metadata();
      expect(meta.width, rel).toBe(w);
    }
  });

  it("encodes favicon.ico with 16, 32, and 48px entries", async () => {
    const ico = await fs.readFile(path.join(PUBLIC_DIR, "favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3); // 3 images

    const sizes = [ico.readUInt8(6), ico.readUInt8(22), ico.readUInt8(38)];
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("validates site.webmanifest and robots.txt", async () => {
    const raw = await fs.readFile(path.join(PUBLIC_DIR, "site.webmanifest"), "utf8");
    const manifest = JSON.parse(raw);
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#3F113D");
    expect(manifest.background_color).toBe("#F6FBDD");
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    expect(manifest.shortcuts).toHaveLength(3);

    const robots = await fs.readFile(path.join(PUBLIC_DIR, "robots.txt"), "utf8");
    expect(robots).toContain("Allow: /favicon.ico");
  });

  it("renders transactional email HTML with logo-email.png and alt text", () => {
    const html = renderReceiptHtml({
      invoiceId: "INV-100",
      workspaceName: "Demo",
      credits: 25,
      amountDisplay: "$9.00 USD",
      dateIso: "2026-11-19",
    });
    expect(html).toContain("/brand/logo-email.png");
    expect(html).toContain('alt="Jingle Studio Tools"');
  });
});
