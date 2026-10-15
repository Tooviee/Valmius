import { headers } from "next/headers";
import { getOrgContext } from "@/lib/auth/session";
import { toCsv } from "@/lib/report/csv";
import { loadEvidence } from "@/lib/report/load";
import { getIpHash } from "@/lib/rate-limit/ip";
import { SCENARIO_TYPE_LABELS } from "@/lib/schemas/scenario";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** The vault's exercise table as CSV, for an auditor's evidence request. */
export async function GET(): Promise<Response> {
  const session = await getOrgContext();
  if (!session) return new Response("Sign in to export evidence.", { status: 401 });
  const supabase = await createClient();
  const evidence = await loadEvidence(supabase, session.org.id);

  const csv = toCsv(
    [
      "exercise",
      "scenario_type",
      "scenario",
      "status",
      "started_at",
      "ended_at",
      "participants_invited",
      "participants_attended",
      "participants_signed_off",
      "plan_version",
      "report_version",
      "report_finalized_at",
      "report_sha256",
    ],
    evidence.exercises.map((e) => [
      e.title,
      SCENARIO_TYPE_LABELS[e.scenario.type],
      e.scenario.title,
      e.status,
      e.started_at,
      e.ended_at,
      e.participants.total,
      e.participants.attended,
      e.participants.signedOff,
      e.plan_version,
      e.report?.version ?? null,
      e.report?.finalized_at ?? null,
      e.report?.sha256 ?? null,
    ]),
  );
  await logEvent(
    "evidence_exported",
    { rows: evidence.exercises.length },
    getIpHash(await headers()),
    session.org.id,
  );

  const slug =
    session.org.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "organization";
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-evidence.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
