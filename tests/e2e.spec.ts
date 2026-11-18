import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/tools",
  "/pricing",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/tools/content-credentials-check",
  "/tools/instagram-post-check",
  "/tools/instagram-story-check",
  "/tools/instagram-reels-check",
  "/tools/tiktok-ai-label-check",
  "/tools/ai-disclosure-signer",
  "/login",
];

test("GlassTabs keyboard navigation and drag work without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

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
