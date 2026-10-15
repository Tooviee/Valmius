import { describe, expect, it } from "vitest";
import { SEEDED_PACKS } from "@/lib/llm/packs";
import { renderScenarioPdf, scenarioPdfFilename } from "@/lib/pdf/render";
import { toPdfText } from "@/lib/pdf/text";
import { scenarioSchema } from "@/lib/schemas/scenario";
import ransomwareFixture from "../fixtures/llm/scenario-ransomware.json";

const fixture = scenarioSchema.parse(ransomwareFixture);

describe("scenario PDF", () => {
  it("renders a fixture to a multi-page PDF", async () => {
    const pdf = await renderScenarioPdf(fixture, new Date("2026-10-06T12:00:00Z"));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    // One page object per page; the scenario plus the template is at least 4 pages.
    const pageCount = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThanOrEqual(4);
  });

  it("renders the longest seeded pack without error", async () => {
    const longest = [...SEEDED_PACKS].sort(
      (a, b) => JSON.stringify(b.scenario).length - JSON.stringify(a.scenario).length,
    )[0]!;

    const pdf = await renderScenarioPdf(longest.scenario);

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("names the download after the scenario type", () => {
    expect(scenarioPdfFilename({ ...fixture, type: "cloud_credential" })).toBe(
      "valmius-cloud-credential-scenario.pdf",
    );
  });
});

describe("toPdfText", () => {
  it("maps typographic punctuation to plain characters", () => {
    expect(toPdfText("“Quoted” — it’s 5–10 min…")).toBe('"Quoted" - it\'s 5-10 min...');
  });

  it("removes characters the built-in PDF font cannot draw", () => {
    expect(toPdfText("Pay now \u{1F4B0} 中文 ok")).toBe("Pay now   ok");
    expect(toPdfText("café © 2026")).toBe("café © 2026");
  });
});
