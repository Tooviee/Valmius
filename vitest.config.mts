import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `server-only` throws when imported outside a React Server environment.
      "server-only": fromRoot("./tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // Tests never spend money: the mock provider is forced here, not only in .env.
    // The dummy key means even a leaked real client could not authenticate.
    env: {
      LLM_PROVIDER: "mock",
      ANTHROPIC_API_KEY: "test-not-a-real-key",
    },
  },
});
