import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("forces the mock LLM provider", () => {
    expect(process.env.LLM_PROVIDER).toBe("mock");
  });

  it("never carries a real Anthropic key", () => {
    expect(process.env.ANTHROPIC_API_KEY).toBe("test-not-a-real-key");
  });

  it("blocks outbound network requests", async () => {
    await expect(fetch("https://api.anthropic.com/v1/messages")).rejects.toThrow(
      /must not make network requests/,
    );
  });
});
