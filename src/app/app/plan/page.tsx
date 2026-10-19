import type { Metadata } from "next";
import Link from "next/link";
import { ApprovePlanForm } from "@/components/plan/approve-plan-form";
import { GeneratePlanForm } from "@/components/plan/generate-plan-form";
import { PlanEditor } from "@/components/plan/plan-editor";
import { VersionNav } from "@/components/plan/version-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";
import { loadPlan, loadPlanFacts, loadPlanVersions } from "@/lib/plan/load";
import { loadEvidence } from "@/lib/report/load";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "IR plan",
  robots: { index: false, follow: false },
};

// Generating a plan runs ten model calls, five at a time.
export const maxDuration = 300;

const formatDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(iso));

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { org } = await requireOrg();
  const supabase = await createClient();
  const [versions, loaded, params, evidence] = await Promise.all([
    loadPlanVersions(supabase, org.id),
    loadPlanFacts(supabase, org),
    searchParams,
    loadEvidence(supabase, org.id),
  ]);
  const lastTested =
    evidence.exercises.find((e) => e.ended_at && e.report) ??
    evidence.exercises.find((e) => e.ended_at) ??
    null;

  if (versions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader
          title="Incident response plan"
          description="An 11-section written plan generated from your questionnaire answers. You edit it, approve it, and export it as PDF or Word."
        />
        {loaded ? (
          <Card>
            <CardHeader>
              <CardTitle>Ready to generate</CardTitle>
              <CardDescription>
                The plan names {org.name}&apos;s systems, roles and obligations from the
                questionnaire. Every section can be edited or regenerated afterwards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GeneratePlanForm />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Finish the questionnaire first</CardTitle>
              <CardDescription>
                The plan is written from your answers, so every required question needs an answer
                before it can be generated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/app/questionnaire" className={buttonVariants()}>
                Open the questionnaire
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const requested = Number(params.v);
  const summary = versions.find((v) => v.version === requested) ?? versions[0];
  const plan = await loadPlan(supabase, summary.id);
  if (!plan) throw new Error("The plan version could not be loaded");
  const approved = plan.status === "approved";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Incident response plan"
        actions={
          <>
            <a
              href={`/app/plan/${plan.id}/export/pdf`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export PDF
            </a>
            <a
              href={`/app/plan/${plan.id}/export/docx`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export Word
            </a>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={approved ? "secondary" : "outline"} data-testid="plan-status">
            Version {plan.version} · {approved ? "approved" : "draft"}
          </Badge>
          <span>Created {formatDate(plan.created_at, org.timezone)}</span>
          {approved && (
            <span>
              · Approved by {plan.approved_by_name} on {formatDate(plan.approved_at!, org.timezone)}
            </span>
          )}
        </div>
        <VersionNav versions={versions} current={plan.version} />
        <p className="text-sm text-muted-foreground" data-testid="last-tested">
          {lastTested?.ended_at ? (
            <>
              Last tested {formatDate(lastTested.ended_at, org.timezone)} ·{" "}
              <Link
                href={`/app/exercises/${lastTested.id}/report`}
                className="underline underline-offset-4"
              >
                {lastTested.report ? "after-action report" : "report not written yet"}
              </Link>
            </>
          ) : (
            <>
              Not tested yet ·{" "}
              <Link href="/app/exercises/new" className="underline underline-offset-4">
                plan an exercise
              </Link>
            </>
          )}
        </p>
      </PageHeader>

      <PlanEditor key={plan.id} planId={plan.id} sections={plan.sections} readOnly={approved} />

      {!approved && (
        <ApprovePlanForm
          planId={plan.id}
          version={plan.version}
          approverHint={loaded?.facts.review.approver ?? "the plan approver"}
        />
      )}

      {loaded && (
        <Card className="bg-muted/40">
          <CardHeader>
            <CardTitle className="text-base">Start over from the questionnaire</CardTitle>
            <CardDescription>
              Generates a brand-new version from your current answers. Existing versions are kept.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneratePlanForm label="Generate a new version" variant="outline" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
