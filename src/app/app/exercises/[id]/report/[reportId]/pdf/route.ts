import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getOrgContext } from "@/lib/auth/session";
import { reportPdfFilename } from "@/lib/pdf/report";
import { loadReport } from "@/lib/report/load";
import { signedReportUrl } from "@/lib/report/storage";
import { getIpHash } from "@/lib/rate-limit/ip";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Hands out a final report PDF: membership is checked through the session (RLS on the
 * reports row), then the browser is sent to a ten-minute signed Storage URL.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/app/exercises/[id]/report/[reportId]/pdf">,
): Promise<Response> {
  const { id, reportId } = await context.params;
  const session = await getOrgContext();
  if (!session) return new Response("Sign in to download a report.", { status: 401 });

  const supabase = await createClient();
  const report = await loadReport(supabase, reportId);
  if (!report || report.exercise_id !== id || report.status !== "final" || !report.pdf_path) {
    return new Response("Report not found.", { status: 404 });
  }

  const url = await signedReportUrl(
    report.pdf_path,
    reportPdfFilename(session.org.name, report.content.cover.exercise_title, report.version),
  );
  await logEvent(
    "report_downloaded",
    { version: report.version },
    getIpHash(await headers()),
    session.org.id,
  );
  return Response.redirect(url, 302);
}
