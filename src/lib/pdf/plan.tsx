import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { PlanExportInput } from "@/lib/plan/export";
import { PlanDocument } from "./plan-document";

/** Renders the plan PDF with the version and approval footer on every page. */
export async function renderPlanPdf(input: PlanExportInput): Promise<Buffer> {
  return renderToBuffer(<PlanDocument input={input} />);
}
