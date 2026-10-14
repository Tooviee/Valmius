import "server-only";
import { headers } from "next/headers";
import { getOrgContext } from "@/lib/auth/session";
import { getIpHash } from "@/lib/rate-limit/ip";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import { planExportFilename, type PlanExportInput } from "./export";
import { loadPlan } from "./load";

type Renderer = (input: PlanExportInput) => Promise<Buffer>;

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/**
 * Shared body of the export route handlers: the plan is read with the user's own
 * session, so RLS decides whether they may see it, then rendered and returned as a file.
 */
export async function exportPlanResponse(
  planId: string,
  format: keyof typeof CONTENT_TYPES,
  render: Renderer,
): Promise<Response> {
  const context = await getOrgContext();
  if (!context) return new Response("Sign in to export a plan.", { status: 401 });

  const supabase = await createClient();
  const plan = await loadPlan(supabase, planId);
  if (!plan) return new Response("Plan not found.", { status: 404 });

  const input: PlanExportInput = {
    orgName: context.org.name,
    timeZone: context.org.timezone,
    plan,
    generatedAt: new Date(),
  };
  const file = await render(input);
  await logEvent(
    "plan_exported",
    { format, version: plan.version, status: plan.status },
    getIpHash(await headers()),
    context.org.id,
  );

  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${planExportFilename(input, format)}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "private, no-store",
    },
  });
}
