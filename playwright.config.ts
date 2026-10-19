import { defineConfig, devices } from "@playwright/test";
import { E2E_TEST_IP } from "./tests/helpers/test-data";

// A port of its own, and never reusing a running server, so the smoke test cannot
// attach to a dev server that was started with LLM_PROVIDER=anthropic.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  // Clears and then removes the rows the tests create in the hosted Supabase project.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Every request carries a reserved test IP, so rate limits and events are isolated.
    extraHTTPHeaders: { "x-forwarded-for": E2E_TEST_IP },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /phone\.spec\.ts/,
    },
    {
      // iPhone 13 size and touch, in Chromium so no second browser download is needed.
      name: "phone",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      testMatch: /phone\.spec\.ts/,
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    // process.env wins over .env.local in Next.js, so these override the real settings.
    env: {
      LLM_PROVIDER: "mock",
      ANTHROPIC_API_KEY: "e2e-not-a-real-key",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
