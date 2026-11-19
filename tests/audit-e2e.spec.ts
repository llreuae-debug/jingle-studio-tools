import { expect, test } from "@playwright/test";

const SITEMAP_PATHS = [
  "/tools",
  "/tools/content-credentials-check",
  "/tools/instagram-post-check",
  "/tools/instagram-story-check",
  "/tools/instagram-reels-check",
  "/tools/tiktok-ai-label-check",
  "/tools/ai-disclosure-signer",
  "/verify",
  "/how-it-works",
  "/learn",
  "/learn/content-credentials",
  "/learn/synthid",
  "/blog",
  "/blog/how-to-read-a-content-credentials-report",
  "/blog/how-to-disclose-ai-use-in-property-marketing",
  "/blog/what-to-do-if-a-real-photo-is-labelled-as-ai",
  "/blog/content-credentials-and-synthid",
  "/faq",
  "/contact",
  "/developers",
  "/developers/rest-api",
  "/developers/mcp",
  "/developers/docs",
  "/pricing",
  "/privacy",
  "/terms",
  "/acceptable-use",
];

test("Audit: Root / redirects 307 to /tools with query preserved, true 404s, and sitemap matches all 27 public routes", async ({
  request,
}) => {
  const rootRes = await request.get("/?lang=id", { maxRedirects: 0 });
  expect(rootRes.status()).toBe(307);
  expect(rootRes.headers()["location"]).toContain("/tools?lang=id");
  expect(rootRes.headers()["x-powered-by"]).toBeUndefined();

  // True 404 checks
  for (const missing of [
    "/does-not-exist-audit",
    "/blog/does-not-exist-audit",
    "/p/does-not-exist-audit",
  ]) {
    const res = await request.get(missing);
    expect(res.status(), missing).toBe(404);
  }

  // Sitemap completeness
  const smRes = await request.get("/sitemap.xml");
  expect(smRes.status()).toBe(200);
  const xml = await smRes.text();
  for (const p of SITEMAP_PATHS) {
    expect(xml, p).toContain(`${p}</loc>`);
  }
});

for (const routePath of SITEMAP_PATHS) {
  test(`Audit SEO, Images & Multi-Viewport Overflow: ${routePath}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    for (const vp of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(vp);
      const res = await page.goto(routePath, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${routePath} @ ${vp.width}`).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();

      if (vp.width === 1280) {
        const title = await page.title();
        expect(title.trim().length, `${routePath} title`).toBeGreaterThan(0);

        const desc = await page
          .locator('meta[name="description"]')
          .first()
          .getAttribute("content");
        expect(desc?.trim().length || 0, `${routePath} meta description`).toBeGreaterThan(10);

        const canonical = await page
          .locator('link[rel="canonical"]')
          .first()
          .getAttribute("href");
        expect(canonical, `${routePath} canonical`).toContain(routePath);

        const imgsOk = await page.$$eval("img", (imgs) =>
          imgs.every((img) => img.complete && img.naturalWidth > 0)
        );
        expect(imgsOk, `${routePath} broken img`).toBe(true);
      }

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflow, `${routePath} overflow @ ${vp.width}px`).toBe(false);
    }

    expect(errors).toEqual([]);
  });
}

test("Audit UI Interactions: Desktop Tools dropdown auto-closes, Mobile menu routes, Filter & corrupt file handling", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // Desktop dropdown open + navigate + auto-close
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tools", { waitUntil: "networkidle" });

  const toolsSummary = page.locator("header nav summary").first();
  await toolsSummary.click();
  await expect(page.locator("header nav details[open]")).toHaveCount(1);
  await page
    .locator("header nav details a", { hasText: "Instagram Post Check" })
    .click();
  await page.waitForURL(/\/tools\/instagram-post-check/);
  await expect(page.locator("header nav details[open]")).toHaveCount(0);

  // Workbench filter updates <input accept> and corrupt disguised PNG shows error + keeps dropzone
  await page.goto("/tools", { waitUntil: "networkidle" });
  const fileInput = page.locator('input[type="file"]').first();
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await expect(fileInput).toHaveAttribute("accept", /\.png.*\.webp/i);
  expect(await fileInput.getAttribute("accept")).not.toContain(".mp4");

  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(fileInput).toHaveAttribute("accept", /\.mp4.*\.webm/i);
  await page.getByRole("button", { name: "All Media", exact: true }).click();

  await fileInput.setInputFiles({
    name: "corrupt-disguised.png",
    mimeType: "image/png",
    buffer: Buffer.from("<html>not-a-real-png</html>", "utf8"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /valid PNG, JPG/i })
  ).toBeVisible();
  await expect(page.getByText("Browse Files")).toBeVisible();

  // Mobile menu toggle includes full routes
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation menu" }).click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Verify File or URL" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Blog" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "FAQ" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("Audit Unauthenticated Client Routes: /app/billing & /app/settings redirect cleanly without hanging", async ({
  page,
}) => {
  await page.goto("/app/billing", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login\?callbackUrl=(?:%2F|\/)app(?:%2F|\/)billing/, { timeout: 10000 });

  await page.goto("/app/settings", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login\?callbackUrl=(?:%2F|\/)app(?:%2F|\/)settings/, { timeout: 10000 });
});

test("Audit Authenticated Workflows, Proof Report/Revoke, Invite Email Isolation, Malformed JSON 400 & Logout CSRF", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const emailA = `audit-user-a-${Date.now()}@example.com`;
  const emailB = `audit-user-b-${Date.now()}@example.com`;
  const pass = "AuditPassword123!";

  // Sign up user A via UI
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill("Audit User A");
  await page.getByLabel("Email address").fill(emailA);
  await page.getByLabel("Password (min 6 characters)").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created and signed in!")).toBeVisible({ timeout: 15000 });

  // Malformed JSON -> 400 (never 500)
  for (const apiPath of ["/api/billing", "/api/keys", "/api/proof", "/api/workspaces"]) {
    const r = await page.request.post(apiPath, {
      headers: { "Content-Type": "application/json" },
      data: "{bad-json",
    });
    expect(r.status(), `Malformed JSON on ${apiPath}`).toBe(400);
  }

  // Billing manual bank transfer + mobile zero overflow
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app/billing", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Request Manual Bank Transfer" }).first().click();
  await expect(page.getByText("Manual Bank Transfer Instructions")).toBeVisible({ timeout: 10000 });
  const billingOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(billingOverflow).toBe(false);

  // Settings save profile + create invite (addressed to a third email)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/app/settings", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Brand or creator name").fill("Audit Brand");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Brand signing profile saved.")).toBeVisible({ timeout: 10000 });

  await page.getByPlaceholder("teammate@company.com").fill("invited-only@example.com");
  await page.getByRole("button", { name: "Create invite" }).click();
  const inviteBox = page.getByText(/Invite token created:/);
  await expect(inviteBox).toBeVisible({ timeout: 10000 });
  const inviteToken = (await inviteBox.locator("code").textContent())?.trim() || "";
  expect(inviteToken.length).toBeGreaterThan(10);

  // Second user must receive 403 trying to accept an invite for another email
  const ctxB = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const pageB = await ctxB.newPage();
  const signupB = await pageB.request.post("/api/auth/signup", {
    data: { name: "Audit User B", email: emailB, password: pass },
  });
  expect(signupB.status()).toBe(200);
  const acceptAttempt = await pageB.request.post("/api/workspaces/invite", {
    data: { action: "accept", token: inviteToken },
  });
  expect(acceptAttempt.status()).toBe(403);
  await ctxB.close();

  // API key create + revoke
  await page.goto("/app/developers", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Key label (e.g. CI Pipeline)").fill("Audit CI Key");
  await page.getByRole("button", { name: "Generate key" }).click();
  await expect(page.getByText(/Copy your API key now/)).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await expect(page.getByText("Revoked")).toBeVisible({ timeout: 10000 });

  // Sign job -> Publish proof -> Abuse report -> Revoke proof
  await page.goto("/app/sign", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').first().setInputFiles("public/favicon-96x96.png");
  await page.locator('input[type="text"][required]').first().fill("Audit Signer");
  await page.getByRole("button", { name: /Sign files/i }).click();
  await page.waitForURL(/\/app\/jobs\/.+/, { timeout: 15000 });
  await expect(page.locator("body")).toContainText("1 / 1 signed", { timeout: 20000 });

  await page.getByRole("button", { name: "Publish proof page" }).first().click();
  const proofLink = page.getByRole("link", { name: /Proof \(live\)/i });
  await expect(proofLink).toBeVisible({ timeout: 10000 });
  await proofLink.click();
  await page.waitForURL(/\/p\/.+/, { timeout: 10000 });

  await page.getByText("Report abuse or misleading disclosure").click();
  await page.getByPlaceholder("Details (optional)").fill("Automated audit verification report.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByText("Report submitted.")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Revoke proof page" }).click();
  await expect(page.getByText("Proof record revoked")).toBeVisible({ timeout: 10000 });

  // Cross-origin logout blocked (403)
  const crossLogout = await page.request.post("/api/auth/logout", {
    headers: { Origin: "https://evil.example.com" },
  });
  expect(crossLogout.status()).toBe(403);

  // Normal AccountMenu logout clears session and /app redirects to /login
  await page.goto("/tools", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Audit User A/i }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/tools/, { timeout: 10000 });
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/);

  expect(errors).toEqual([]);
});
