import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /e2e\.spec\.ts/,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    command: "./node_modules/.bin/next start -H 127.0.0.1 -p 3000",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      AUTH_SECRET: "playwright-test-secret-32-bytes-minimum",
      ALLOW_LOCAL_TOKEN_PREVIEW: "true",
    },
  },
});
