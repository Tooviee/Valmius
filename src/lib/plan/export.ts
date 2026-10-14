import type { PlanSections } from "@/lib/schemas/plan";

/** What both exports (PDF and DOCX) need, independent of how the plan was loaded. */
export type PlanExportInput = {
  orgName: string;
  timeZone: string;
  plan: {
    version: number;
    status: "draft" | "approved";
    approved_by_name: string | null;
    approved_at: string | null;
    created_at: string;
    sections: PlanSections;
  };
  /** When the file was produced; shown in the footer. */
  generatedAt: Date;
};

export const formatPlanDate = (iso: string | Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(iso));

/** "Approved by X on date" or the draft warning; the same words in both exports. */
export function approvalLine(input: PlanExportInput): string {
  const { plan, timeZone } = input;
  if (plan.status === "approved" && plan.approved_by_name && plan.approved_at) {
    return `Approved by ${plan.approved_by_name} on ${formatPlanDate(plan.approved_at, timeZone)}`;
  }
  return "Draft, not yet approved";
}

/** The footer printed on every page (SPEC.md section 7: version and approval on each page). */
export function footerLine(input: PlanExportInput): string {
  return `${input.orgName} | Incident Response Plan v${input.plan.version} | ${approvalLine(input)} | Generated ${formatPlanDate(input.generatedAt, input.timeZone)}`;
}

export function planExportFilename(input: PlanExportInput, extension: "pdf" | "docx"): string {
  const slug =
    input.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "organization";
  return `${slug}-ir-plan-v${input.plan.version}.${extension}`;
}
