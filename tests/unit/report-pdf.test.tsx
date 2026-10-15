import { describe, expect, it } from "vitest";
import { renderReportPdf, reportPdfFilename } from "@/lib/pdf/report";
import { buildReportFacts } from "@/lib/report/build";
import { contentFingerprint, sha256Hex } from "@/lib/report/hash";
import { reportContentSchema } from "@/lib/schemas/report";
import reportFixture from "../fixtures/llm/report.json";
import { sampleExercise, sampleOrg } from "../helpers/report-fixture";

describe("renderReportPdf", () => {
  const content = reportContentSchema.parse({
    ...buildReportFacts(sampleOrg, sampleExercise, "founder@example.test"),
    narrative: { ...reportFixture, origin: "model" },
  });

  it("renders a multi-page PDF whose hash is stable for the same input", async () => {
    const input = {
      content,
      reportId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      generatedAt: new Date("2026-10-15T15:00:00.000Z"),
      fingerprint: contentFingerprint(content),
      siteUrl: "localhost:3000",
    };
    const pdf = await renderReportPdf(input);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(15_000);
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(1);
    expect(sha256Hex(pdf)).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);

  it("names the file after the organization, the exercise and the version", () => {
    expect(reportPdfFilename("Alpha Clinic", "Q4 ransomware drill", 2)).toBe(
      "alpha-clinic-q4-ransomware-drill-after-action-v2.pdf",
    );
  });
});
