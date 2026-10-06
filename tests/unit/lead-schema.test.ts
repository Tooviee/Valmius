import { describe, expect, it } from "vitest";
import { leadSchema } from "@/lib/schemas/lead";

describe("lead schema", () => {
  it("normalizes the email and keeps valid context fields", () => {
    const result = leadSchema.parse({
      email: "  Jane@Example.com ",
      source: "generator",
      industry: "healthcare",
      headcountBand: "11-50",
      scenarioType: "ransomware",
    });

    expect(result).toEqual({
      email: "jane@example.com",
      source: "generator",
      industry: "healthcare",
      headcountBand: "11-50",
      scenarioType: "ransomware",
    });
  });

  it("drops empty or unknown context fields instead of rejecting the lead", () => {
    const result = leadSchema.parse({
      email: "jane@example.com",
      source: "landing",
      industry: "",
      headcountBand: null,
      scenarioType: "phishing",
    });

    expect(result).toEqual({ email: "jane@example.com", source: "landing" });
  });

  it("rejects an invalid email or source", () => {
    expect(leadSchema.safeParse({ email: "not-an-email", source: "generator" }).success).toBe(
      false,
    );
    expect(leadSchema.safeParse({ email: "", source: "generator" }).success).toBe(false);
    expect(leadSchema.safeParse({ email: "jane@example.com", source: "spam" }).success).toBe(false);
  });
});
