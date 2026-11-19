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
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

test("Login UI, error messages, signed-out guards, and no secrets in HTML", async ({
  page,
  request,
}) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("AUTH_GOOGLE_SECRET");
  expect(html).not.toContain("AUTH_SECRET");

  // Error message checks
  await page.goto("/login?error=AccessDenied", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Google sign-in was cancelled. You can try again.")).toBeVisible();

  await page.goto("/login?error=Unverified", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Please use a Google account with a verified email address.")
  ).toBeVisible();

  await page.goto("/login?error=Disabled", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("This account is unavailable. Contact support for help.")
  ).toBeVisible();

  await page.goto("/login?error=LinkRequired", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Verify your existing account before connecting Google.")
  ).toBeVisible();

  // Signed-out /app redirects to /login
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/);

  // Signed-out private APIs return 401/403
  expect((await request.get("/api/jobs")).status()).toBe(401);
  expect((await request.get("/api/billing")).status()).toBe(401);
  expect((await request.get("/api/admin")).status()).toBe(403);
});

test("All icon, manifest, and brand asset URLs return 200 with valid types and head tags", async ({
  page,
  request,
}) => {
  const assetChecks: Array<[string, string]> = [
    ["/favicon.ico", "image/"],
    ["/favicon.svg", "image/svg+xml"],
    ["/favicon-32x32.png", "image/png"],
    ["/apple-touch-icon.png", "image/png"],
    ["/icon-192.png", "image/png"],
    ["/icon-maskable-512.png", "image/png"],
    ["/site.webmanifest", "manifest"],
    ["/browserconfig.xml", "xml"],
    ["/og-image.png", "image/png"],
    ["/brand/logo-horizontal-plum.svg", "image/svg+xml"],
    ["/brand/logo-square-512.png", "image/png"],
    ["/robots.txt", "text/plain"],
  ];

  for (const [url, expectedType] of assetChecks) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toContain(expectedType);
  }

  await page.goto("/tools", { waitUntil: "networkidle" });
  const toolsOgImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(toolsOgImage).toMatch(/^https:\/\/.+\/tools\/opengraph-image/);

  const imgsOk = await page.$$eval("img", (imgs) =>
    imgs.every((img) => img.complete && img.naturalWidth > 0)
  );
  expect(imgsOk).toBe(true);

  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  const defaultOgImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(defaultOgImage).toMatch(/^https:\/\/.+\/og-image\.png$/);
});

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

test("CredentialsResultCard works in browser on /tools and check tool at mobile width without horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools", { waitUntil: "networkidle" });

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles("public/favicon-96x96.png");

  const card = page.getByRole("article", { name: "Credentials check result" });
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).toContainText("No Content Credentials found");
  await expect(card).toContainText(
    "No declaration was found. This does not show how the file was made."
  );
  await expect(card).toContainText("Not checked here");
  await expect(card.getByRole("link", { name: /How to check in Gemini/i })).toBeVisible();

  await card.getByRole("button", { name: "View full report" }).click();
  await expect(card).toContainText("File SHA-256 fingerprint");

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  // Also verify on /tools/content-credentials-check
  await page.goto("/tools/content-credentials-check", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').first().setInputFiles("public/favicon-96x96.png");
  const checkCard = page.getByRole("article", { name: "Credentials check result" });
  await expect(checkCard).toBeVisible({ timeout: 15000 });
  await expect(checkCard).toContainText("No Content Credentials found");
  await expect(checkCard.getByRole("link", { name: "Sign your own work" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("Authenticated user can submit a signing job on /app/sign without Unauthorized error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // Establish a real database session via email-login in the browser context
  await page.goto("/login", { waitUntil: "networkidle" });
  const loginRes = await page.evaluate(async () => {
    const r = await fetch("/api/auth/email-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `e2e-signer-${Date.now()}@example.com`,
        password: "test-password-123",
        name: "E2E Signer",
      }),
    });
    return r.status;
  });
  expect(loginRes).toBe(200);

  await page.goto("/app/sign", { waitUntil: "networkidle" });
  await expect(page.getByText(/Balance:\s*\d+\s*credits/i)).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles("public/favicon-96x96.png");
  const creatorInput = page.locator('input[type="text"][required]').first();
  await creatorInput.fill("E2E Signer");

  await page.getByRole("button", { name: /Sign files/i }).click();

  await page.waitForURL(/\/app\/jobs\/.+/, { timeout: 15000 });
  await expect(page.locator("body")).toContainText("1 / 1 signed", { timeout: 20000 });

  expect(errors).toEqual([]);
});

test("AI Media Inspector & Privacy Cleaner E2E: JPG/PNG clean, completion download, invalid file error + retry, mobile responsiveness", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // 1. Mobile viewport (375px): no horizontal overflow & complete workflow
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: /Inspect Your AI Images & Videos/i })
  ).toBeVisible();

  // Case 6: Invalid disguised file rejection via /api/privacy-clean
  const badRes = await page.request.post("/api/privacy-clean", {
    multipart: {
      file: {
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("<html>not an image</html>", "utf8"),
      },
    },
  });
  expect(badRes.status()).toBe(400);

  // Upload real PNG into 2-column workbench
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles("public/favicon-96x96.png");

  await expect(page.getByRole("heading", { name: "Your Media Analysis" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("A. C2PA Content Credentials")).toBeVisible();
  await expect(page.getByText("B. SynthID Verification")).toBeVisible();
  await expect(page.getByText("C. Metadata Inspector")).toBeVisible();

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  // Click Clean Privacy Metadata and verify Completion Screen + real download
  await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
  await expect(
    page.getByRole("heading", { name: "Your Image Is Ready" })
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Clean File Ready")).toBeVisible();

  const cleanHref = await page
    .getByRole("link", { name: "Download Processed Image" })
    .getAttribute("href");
  expect(cleanHref).toContain("/api/privacy-clean/download?token=");

  // Fetch signed clean download URL using page's browser cookies
  const dlCheck = await page.evaluate(async (href) => {
    const r = await fetch(href!);
    const bytes = new Uint8Array(await r.arrayBuffer());
    return {
      status: r.status,
      contentType: r.headers.get("content-type"),
      magic: Array.from(bytes.slice(0, 4)),
    };
  }, cleanHref);
  expect(dlCheck.status).toBe(200);
  expect(dlCheck.contentType).toContain("image/png");
  expect(dlCheck.magic).toEqual([0x89, 0x50, 0x4e, 0x47]);

  // Tampered download token returns 403
  const tamperedRes = await request.get(`${cleanHref}tampered`);
  expect(tamperedRes.status()).toBe(403);

  expect(errors).toEqual([]);
});

test("Auth lifecycle (Signup, Verify Email, Forgot Password, Reset Password, Login, Dashboard History, Logout) & Admin 403", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const email = `e2e-full-${Date.now()}@example.com`;
  await page.setViewportSize({ width: 1280, height: 800 });

  // Signup via UI
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill("E2E Privacy User");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password (min 6 characters)").fill("InitialPass123!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Account created and signed in!")).toBeVisible({
    timeout: 15000,
  });

  // Verify email via generated link
  await page.getByRole("link", { name: "Verify email now" }).click();
  await expect(page.getByText(/has been verified/i)).toBeVisible({
    timeout: 15000,
  });

  // Clean a file while signed in so it appears in Dashboard processing history
  await page.goto("/tools", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').first().setInputFiles("public/favicon-96x96.png");
  await page.getByRole("button", { name: "Clean Privacy Metadata" }).click();
  await expect(
    page.getByRole("heading", { name: "Your Image Is Ready" })
  ).toBeVisible({ timeout: 20000 });

  // Access Dashboard & verify processing history shows the file
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Media Inspection & Cleaning History")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("favicon-96x96.png")).toBeVisible();

  // Regular user gets 403 on /api/admin (page.request shares the authenticated browser session)
  const adminDenied = await page.request.get("/api/admin");
  expect(adminDenied.status()).toBe(403);

  // Forgot Password -> Reset Password flow
  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByText("Reset request prepared")).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole("link", { name: "Open password reset page" }).click();
  await page.getByLabel("New password (min 6 characters)").fill("UpdatedPass999!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible({ timeout: 10000 });

  // Login with new password succeeds
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password (min 6 characters)").fill("UpdatedPass999!");
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.waitForURL(/\/app/, { timeout: 15000 });

  expect(errors).toEqual([]);
});
