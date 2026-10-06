import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Integration tests that talk to the hosted Supabase project (`pnpm test:db`).
// They still run with the mock LLM provider and may only reach the Supabase host.
export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      "server-only": fromRoot("./tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.db.test.ts"],
    setupFiles: ["./tests/setup.db.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      LLM_PROVIDER: "mock",
      ANTHROPIC_API_KEY: "test-not-a-real-key",
    },
  },
});
