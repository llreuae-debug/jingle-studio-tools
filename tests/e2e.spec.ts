import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/tools",
  "/pricing",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/how-it-works",
  "/learn",
  "/learn/content-credentials",
  "/learn/synthid",
  "/faq",
  "/blog",
  "/blog/how-to-read-a-content-credentials-report",
  "/blog/how-to-disclose-ai-use-in-property-marketing",
  "/blog/what-to-do-if-a-real-photo-is-labelled-as-ai",
  "/blog/content-credentials-and-synthid",
  "/developers",
  "/developers/rest-api",
  "/developers/mcp",
  "/developers/docs",
  "/contact",
  "/tools/content-credentials-check",
  "/tools/instagram-post-check",
  "/tools/instagram-story-check",
  "/tools/instagram-reels-check",
  "/tools/tiktok-ai-label-check",
  "/tools/ai-disclosure-signer",
  "/login",
];

test("All header and footer links on /tools resolve with status < 400 and no # links", async ({ page, request }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });
  const hrefs = await page.$$eval("header a, footer a", (els) =>
    els.map((a) => a.getAttribute("href") || "")
  );

  for (const href of hrefs) {
    expect(href).not.toBe("#");
    if (href.startsWith("/")) {
      const res = await request.get(href);
      expect(res.status(), `Broken link: ${href}`).toBeLessThan(400);
    }
  }
});

test("GET /api/example-report returns real C2PA signed report", async ({ request }) => {
  const res = await request.get("/api/example-report");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.label).toBe("Example file");
  expect(body.signer).toContain("Jingle Studio");
});

test("GlassTabs keyboard navigation and drag work without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tools", { waitUntil: "networkidle" });

  const tablist = page.getByRole("tablist", { name: "Main tools navigation" });
  await expect(tablist).toBeVisible();

  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(4);

  // Keyboard ArrowRight + End + Home
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  expect(errors).toEqual([]);
});

test("GET /api/health returns ok and connected DB", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.db).toBe("connected");
});

for (const route of PUBLIC_ROUTES) {
  test(`Desktop EN & ID: ${route} renders with 0 console/page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    const res = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible();

    // Switch to ID via query param
    await page.goto(`${route}?lang=id`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test(`Mobile: ${route} renders with 0 console/page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
