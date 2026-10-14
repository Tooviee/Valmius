import { describe, expect, it } from "vitest";
import { renderPlanDocx } from "@/lib/docx/plan-docx";
import { renderPlanPdf } from "@/lib/pdf/plan";
import {
  approvalLine,
  footerLine,
  planExportFilename,
  type PlanExportInput,
} from "@/lib/plan/export";
import { buildNotificationMatrixSection } from "@/lib/plan/notification-matrix";
import {
  PLAN_SECTION_IDS,
  planSectionMeta,
  planSectionOutputSchema,
  type PlanSections,
} from "@/lib/schemas/plan";
import fixtures from "../fixtures/llm/plan-sections.json";

const sections: PlanSections = PLAN_SECTION_IDS.map((id) => {
  if (id === "notification_matrix") {
    return buildNotificationMatrixSection({
      companyName: "Alpha Clinic",
      frameworks: ["hipaa"],
      dataTypes: [],
      regulatoryObligations: ["hipaa"],
      owners: { legal: "COO", executive: "CEO", communications: "Comms", technical: "IT" },
    });
  }
  return {
    id,
    title: planSectionMeta(id).title,
    ...planSectionOutputSchema.parse(fixtures[id]),
    origin: "model",
  };
});

const draft: PlanExportInput = {
  orgName: "Alpha Clinic",
  timeZone: "America/New_York",
  plan: {
    version: 2,
    status: "draft",
    approved_by_name: null,
    approved_at: null,
    created_at: "2026-10-14T03:30:00.000Z",
    sections,
  },
  generatedAt: new Date("2026-10-14T04:00:00.000Z"),
};

const approved: PlanExportInput = {
  ...draft,
  plan: {
    ...draft.plan,
    status: "approved",
    approved_by_name: "Jordan Park, CEO",
    approved_at: "2026-10-14T03:45:00.000Z",
  },
};

describe("plan export metadata", () => {
  it("prints the version and approval on the footer line", () => {
    expect(approvalLine(draft)).toBe("Draft, not yet approved");
    expect(approvalLine(approved)).toBe("Approved by Jordan Park, CEO on Oct 13, 2026");
    expect(footerLine(approved)).toBe(
      "Alpha Clinic | Incident Response Plan v2 | Approved by Jordan Park, CEO on Oct 13, 2026 | Generated Oct 14, 2026",
    );
  });

  it("builds a safe filename from the organization name", () => {
    expect(planExportFilename(draft, "pdf")).toBe("alpha-clinic-ir-plan-v2.pdf");
    expect(planExportFilename({ ...draft, orgName: "Ünïcode & Co!" }, "docx")).toBe(
      "n-code-co-ir-plan-v2.docx",
    );
  });
});

describe("renderPlanPdf", () => {
  it("renders a multi-page PDF for the fixture plan", async () => {
    const pdf = await renderPlanPdf(approved);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(3);
  }, 30_000);

  it("renders a draft with the draft banner", async () => {
    const pdf = await renderPlanPdf(draft);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});

describe("renderPlanDocx", () => {
  it("renders a Word document (a zip with the document part)", async () => {
    const docx = await renderPlanDocx(approved);
    expect(docx.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(docx.length).toBeGreaterThan(10_000);
    // Zip central directory entries carry file names in clear text.
    const raw = docx.toString("latin1");
    expect(raw).toContain("word/document.xml");
    expect(raw).toContain("word/footer1.xml");
  });
});
