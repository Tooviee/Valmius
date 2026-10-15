import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GenerateReportForm } from "@/components/report/generate-report-form";
import { ReportEditor } from "@/components/report/report-editor";
import { ReportFacts } from "@/components/report/report-facts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";
import { loadExercise } from "@/lib/exercise/load";
import { loadReport, loadReports } from "@/lib/report/load";
import { createClient } from "@/lib/supabase/server";
import { amendReportAction } from "@/server/actions/report";

export const metadata: Metadata = {
  title: "After-action report",
  robots: { index: false, follow: false },
};

// Generating the narrative is one model call; finalizing renders and uploads a PDF.
export const maxDuration = 120;

const fmt = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(iso),
  );

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { org } = await requireOrg();
  const { id } = await params;
  const { v } = await searchParams;
  const supabase = await createClient();
  const exercise = await loadExercise(supabase, id);
  if (!exercise) notFound();
  if (exercise.status === "scheduled" || exercise.status === "live")
    redirect(`/app/exercises/${exercise.id}`);

  const versions = await loadReports(supabase, exercise.id);
  const crumbs = (
    <p className="text-sm text-muted-foreground">
      <Link href="/app/exercises" className="underline-offset-4 hover:underline">
        Exercises
      </Link>{" "}
      /{" "}
      <Link href={`/app/exercises/${exercise.id}`} className="underline-offset-4 hover:underline">
        {exercise.title}
      </Link>{" "}
      / Report
    </p>
  );

  if (versions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        {crumbs}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">After-action report</h1>
          <p className="text-muted-foreground">
            The dated record of this exercise: who took part, what was decided and when, what was
            found, and which controls it evidences. You edit the narrative, then finalize it into a
            PDF with a verifiable hash.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Ready to write</CardTitle>
            <CardDescription>
              {exercise.decisions.length} decisions, {exercise.findings.length} findings and{" "}
              {exercise.participants.filter((p) => p.signed_off_at).length} sign-offs are on record.
              {exercise.participants.some((p) => p.attended_at && !p.signed_off_at) &&
                " Some attendees have not signed off yet; the report will say so."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateReportForm exerciseId={exercise.id} label="Generate report" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const requested = Number(v);
  const summary = versions.find((r) => r.version === requested) ?? versions[0];
  const report = await loadReport(supabase, summary.id);
  if (!report) notFound();
  const isFinal = report.status === "final";
  const hasDraft = versions.some((r) => r.status === "draft");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {crumbs}
          <h1 className="text-3xl font-semibold tracking-tight">
            After-action report: {exercise.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={isFinal ? "secondary" : "outline"} data-testid="report-status">
              Version {report.version} · {isFinal ? "final" : "draft"}
            </Badge>
            {isFinal && report.finalized_at && (
              <span>Finalized {fmt(report.finalized_at, org.timezone)}</span>
            )}
            {versions.length > 1 && (
              <nav aria-label="Report versions" className="flex items-center gap-1.5">
                <span>Versions:</span>
                {versions.map((r) => (
                  <Link
                    key={r.id}
                    href={`/app/exercises/${exercise.id}/report?v=${r.version}`}
                    aria-current={r.id === report.id ? "page" : undefined}
                    className={`rounded-md border px-2 py-0.5 hover:bg-muted ${r.id === report.id ? "border-primary bg-muted font-medium" : ""}`}
                  >
                    v{r.version}
                    {r.status === "final" ? " ✓" : ""}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isFinal && (
            <>
              <a
                href={`/app/exercises/${exercise.id}/report/${report.id}/pdf`}
                className={buttonVariants({ size: "lg" })}
                data-testid="download-report"
              >
                Download PDF
              </a>
              {!hasDraft && (
                <form action={amendReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <Button type="submit" variant="outline" size="lg">
                    Amend
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {isFinal && report.sha256 && (
        <Alert data-testid="report-hash">
          <AlertTitle>SHA-256 of the PDF</AlertTitle>
          <AlertDescription>
            <code className="break-all text-xs" data-testid="sha256">
              {report.sha256}
            </code>
            <span className="mt-1 block">
              Anyone holding the file can check it: on a Mac or Linux,{" "}
              <code>shasum -a 256 file.pdf</code>; on Windows,{" "}
              <code>certutil -hashfile file.pdf SHA256</code>.
            </span>
          </AlertDescription>
        </Alert>
      )}

      <ReportFacts content={report.content} part="head" />
      <ReportEditor
        key={report.id}
        reportId={report.id}
        narrative={report.content.narrative}
        readOnly={isFinal}
      />
      <ReportFacts content={report.content} part="tail" />

      {!isFinal && (
        <Card className="bg-muted/40">
          <CardHeader>
            <CardTitle className="text-base">Rewrite the narrative</CardTitle>
            <CardDescription>
              Regenerates all five narrative sections from the exercise record. Your edits to this
              draft are replaced.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateReportForm
              exerciseId={exercise.id}
              label="Regenerate narrative"
              variant="outline"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
