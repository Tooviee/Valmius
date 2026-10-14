import type { NextRequest } from "next/server";
import { renderPlanDocx } from "@/lib/docx/plan-docx";
import { exportPlanResponse } from "@/lib/plan/export-route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/app/plan/[id]/export/docx">,
): Promise<Response> {
  const { id } = await context.params;
  return exportPlanResponse(id, "docx", renderPlanDocx);
}
