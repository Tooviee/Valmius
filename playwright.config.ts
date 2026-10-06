import { defineConfig, devices } from "@playwright/test";

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
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
