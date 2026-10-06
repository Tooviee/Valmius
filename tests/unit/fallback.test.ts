import { describe, expect, it } from "vitest";
import { pickSeededPack, pickSeededScenario } from "@/lib/llm/fallback";
import { parseJsonResponse } from "@/lib/llm/parse";
import {
  describeCompany,
  generatorInputSchema,
  type GeneratorInput,
} from "@/lib/schemas/generator";
import { PACK_SCENARIO_TYPES, scenarioSchema } from "@/lib/schemas/scenario";

const input = (overrides: Partial<GeneratorInput>): GeneratorInput =>
  generatorInputSchema.parse({
    industry: "other",
    headcountBand: "11-50",
    hosting: ["aws"],
    scenarioType: "ransomware",
    ...overrides,
  });

describe("seeded fallback", () => {
  it.each(PACK_SCENARIO_TYPES)("returns a %s pack for a %s request", (scenarioType) => {
    expect(pickSeededPack(input({ scenarioType })).type).toBe(scenarioType);
  });

  it("picks the cloud-hosted software variant for a SaaS company on AWS", () => {
    const pack = pickSeededPack(input({ industry: "saas_software", hosting: ["aws", "gcp"] }));
    expect(pack.variant).toBe("a");
  });

  it("picks the SaaS-only services variant for a professional services firm", () => {
    const pack = pickSeededPack(
      input({ industry: "professional_services", hosting: ["saas_only"] }),
    );
    expect(pack.variant).toBe("b");
  });

  it("picks the regulated on-prem variant for a healthcare company with servers", () => {
    const pack = pickSeededPack(input({ industry: "healthcare", hosting: ["on_prem", "azure"] }));
    expect(pack.variant).toBe("c");
  });

  it("rewrites only the company profile and stays schema-valid", () => {
    const chosen = input({
      industry: "financial_services",
      headcountBand: "51-200",
      hosting: ["on_prem", "azure"],
      scenarioType: "bec",
    });
    const original = pickSeededPack(chosen).scenario;

    const personalized = pickSeededScenario(chosen);

    expect(scenarioSchema.safeParse(personalized).success).toBe(true);
    expect(personalized.setting.company_profile).toBe(describeCompany(chosen));
    expect(personalized.injects).toEqual(original.injects);
    expect(personalized.title).toBe(original.title);
    // The bundled pack itself is not modified.
    expect(original.setting.company_profile).not.toBe(personalized.setting.company_profile);
  });
});

describe("describeCompany", () => {
  it("describes platforms and size in plain words", () => {
    expect(
      describeCompany({
        industry: "healthcare",
        headcountBand: "51-200",
        hosting: ["aws", "on_prem"],
      }),
    ).toBe(
      "Healthcare company with 51 to 200 employees. Its systems run on AWS and on-prem servers.",
    );
  });

  it("handles a SaaS-only company", () => {
    expect(
      describeCompany({
        industry: "professional_services",
        headcountBand: "11-50",
        hosting: ["saas_only"],
      }),
    ).toBe(
      "Professional services firm with 11 to 50 employees. It runs entirely on SaaS tools, with no servers of its own.",
    );
  });

  it("mentions SaaS tools alongside other platforms", () => {
    expect(
      describeCompany({
        industry: "other",
        headcountBand: "201+",
        hosting: ["gcp", "azure", "vercel_netlify", "saas_only"],
      }),
    ).toBe(
      "Company with more than 200 employees. Its systems run on GCP, Azure and Vercel/Netlify, alongside SaaS tools.",
    );
  });
});

describe("parseJsonResponse", () => {
  it("parses a bare JSON object", () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("parses an object inside a code fence", () => {
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("parses an object with prose around it", () => {
    expect(parseJsonResponse('Here it is:\n{"a":{"b":2}}\nDone.')).toEqual({
      ok: true,
      value: { a: { b: 2 } },
    });
  });

  it("reports failure for text with no JSON object and for truncated JSON", () => {
    expect(parseJsonResponse("no json here")).toEqual({ ok: false });
    expect(parseJsonResponse('{"a": {"b": 2')).toEqual({ ok: false });
  });
});
