import type { Metadata } from "next";
import Link from "next/link";
import { ExerciseStatusBadge } from "@/components/exercise/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrg } from "@/lib/auth/session";
import { dueState, nextTestDue, type DueState } from "@/lib/report/due";
import { loadEvidence } from "@/lib/report/load";
import { FRAMEWORK_LABELS, type Framework } from "@/lib/schemas/organization";
import { SCENARIO_TYPE_LABELS } from "@/lib/schemas/scenario";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Evidence vault",
  robots: { index: false, follow: false },
};

const fmtDate = (iso: string | Date | null, timeZone: string) =>
  iso
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(iso))
    : "";

const DUE_LABEL: Record<
  DueState,
  { text: string; variant: "outline" | "secondary" | "destructive" | "default" }
> = {
  never_tested: { text: "Never tested", variant: "destructive" },
  ok: { text: "On schedule", variant: "secondary" },
  due_soon: { text: "Due within 60 days", variant: "default" },
  overdue: { text: "Overdue", variant: "destructive" },
};

export default async function EvidencePage() {
  const { org } = await requireOrg();
  const supabase = await createClient();
  const evidence = await loadEvidence(supabase, org.id);
  const state = dueState(evidence.lastEndedAt);
  const due = nextTestDue(evidence.lastEndedAt);
  const frameworks = (org.frameworks as Framework[]).filter((f) => f !== "none");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Evidence vault"
        description="What an auditor, insurer or regulator asks for: the approved plan, every exercise with its dated report and hash, and when the next test is due."
        actions={
          <a
            href="/app/evidence/export"
            className={buttonVariants({ variant: "outline" })}
            data-testid="export-csv"
          >
            Export CSV
          </a>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="approved-plan-card">
          <CardHeader>
            <CardTitle>Incident response plan</CardTitle>
            <CardDescription>The version in force.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {evidence.approvedPlan ? (
              <>
                <p>
                  Version {evidence.approvedPlan.version}, approved by{" "}
                  {evidence.approvedPlan.approved_by_name} on{" "}
                  {fmtDate(evidence.approvedPlan.approved_at, org.timezone)}.
                </p>
                <Link
                  href={`/app/plan?v=${evidence.approvedPlan.version}`}
                  className="underline underline-offset-4"
                >
                  Open the approved version
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">
                No approved version yet.{" "}
                <Link href="/app/plan" className="underline underline-offset-4">
                  Go to the plan
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="next-due-card">
          <CardHeader>
            <CardTitle>Next test due</CardTitle>
            <CardDescription>
              Twelve months after the last exercise that ended, per framework.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={DUE_LABEL[state].variant}>{DUE_LABEL[state].text}</Badge>
              {due && <span data-testid="next-due">Due {fmtDate(due, org.timezone)}</span>}
              {evidence.lastEndedAt && (
                <span className="text-muted-foreground">
                  Last tested {fmtDate(evidence.lastEndedAt, org.timezone)}
                </span>
              )}
            </div>
            {frameworks.length > 0 ? (
              <ul className="space-y-1">
                {frameworks.map((f) => (
                  <li key={f} className="flex justify-between gap-2">
                    <span>{FRAMEWORK_LABELS[f]}</span>
                    <span className="text-muted-foreground">
                      {due ? fmtDate(due, org.timezone) : "no test on record"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No frameworks listed on the organization.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Exercises</h2>
        {evidence.exercises.length === 0 ? (
          <p className="rounded-xl border p-6 text-sm text-muted-foreground">No exercises yet.</p>
        ) : (
          <Table data-testid="evidence-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Exercise</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence.exercises.map((e) => (
                <TableRow key={e.id} data-testid="evidence-row">
                  <TableCell className="whitespace-nowrap">
                    {fmtDate(e.ended_at ?? e.started_at, org.timezone) || "Not run"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/app/exercises/${e.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {e.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {SCENARIO_TYPE_LABELS[e.scenario.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.participants.attended}/{e.participants.total} attended,{" "}
                    {e.participants.signedOff} signed
                  </TableCell>
                  <TableCell>
                    <ExerciseStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.plan_version ? `v${e.plan_version}` : ""}
                  </TableCell>
                  <TableCell>
                    {e.report ? (
                      <div className="space-y-0.5">
                        <a
                          href={`/app/exercises/${e.id}/report/${e.report.id}/pdf`}
                          className="underline underline-offset-4"
                        >
                          PDF v{e.report.version}
                        </a>
                        <code
                          className="block max-w-56 truncate text-xs text-muted-foreground"
                          title={e.report.sha256}
                        >
                          {e.report.sha256}
                        </code>
                      </div>
                    ) : e.status === "ended" ? (
                      <Link
                        href={`/app/exercises/${e.id}/report`}
                        className="underline underline-offset-4"
                      >
                        Write report
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
