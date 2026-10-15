import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";
import { INDUSTRY_LABELS, type Industry } from "@/lib/schemas/generator";
import { FRAMEWORK_LABELS, type Framework } from "@/lib/schemas/organization";
import { dueState, nextTestDue } from "@/lib/report/due";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const formatDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(iso));

export default async function DashboardPage() {
  const { org } = await requireOrg();
  const supabase = await createClient();

  const [questionnaire, latestPlan, approvedPlan, exercises] = await Promise.all([
    supabase
      .from("questionnaires")
      .select("id, completed_at, updated_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ir_plans")
      .select("id, version, status, created_at")
      .eq("org_id", org.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ir_plans")
      .select("id, version, approved_by_name, approved_at")
      .eq("org_id", org.id)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("exercises")
      .select("id, status, ended_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
  ]);
  for (const result of [questionnaire, latestPlan, approvedPlan, exercises]) {
    if (result.error) throw new Error(`Could not load the dashboard: ${result.error.message}`);
  }

  const questionnaireDone = Boolean(questionnaire.data?.completed_at);
  const exerciseRows = exercises.data ?? [];
  const liveExercise = exerciseRows.find((e) => e.status === "live");
  const lastEnded = exerciseRows
    .filter((e) => e.ended_at)
    .sort((a, b) => String(b.ended_at).localeCompare(String(a.ended_at)))[0];
  const frameworks = (org.frameworks as Framework[]).map((f) => FRAMEWORK_LABELS[f] ?? f);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-sm text-muted-foreground">
          {INDUSTRY_LABELS[org.industry as Industry] ?? org.industry} · {org.headcount_band}{" "}
          employees
          {frameworks.length > 0 && ` · ${frameworks.join(", ")}`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card data-testid="questionnaire-card">
          <CardHeader>
            <CardTitle>1. Questionnaire</CardTitle>
            <CardDescription>
              Fifteen questions about your systems, people and obligations. The plan is written from
              these answers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questionnaireDone ? (
              <Badge variant="secondary">
                Complete · updated {formatDate(questionnaire.data!.updated_at, org.timezone)}
              </Badge>
            ) : questionnaire.data ? (
              <Badge variant="outline">In progress</Badge>
            ) : (
              <Badge variant="outline">Not started</Badge>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/app/questionnaire" className={buttonVariants({ size: "sm" })}>
              {questionnaireDone
                ? "Review answers"
                : questionnaire.data
                  ? "Continue"
                  : "Start questionnaire"}
            </Link>
          </CardFooter>
        </Card>

        <Card data-testid="plan-card">
          <CardHeader>
            <CardTitle>2. Incident response plan</CardTitle>
            <CardDescription>
              An 11-section written plan, generated from your answers, edited by you, and approved
              with a name and date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {latestPlan.data ? (
              <Badge variant={latestPlan.data.status === "approved" ? "secondary" : "outline"}>
                Version {latestPlan.data.version} · {latestPlan.data.status}
              </Badge>
            ) : (
              <Badge variant="outline">No plan yet</Badge>
            )}
            {approvedPlan.data && (
              <p className="text-sm text-muted-foreground">
                Approved version {approvedPlan.data.version} by {approvedPlan.data.approved_by_name}{" "}
                on {formatDate(approvedPlan.data.approved_at!, org.timezone)}.
              </p>
            )}
          </CardContent>
          <CardFooter>
            {latestPlan.data ? (
              <Link href="/app/plan" className={buttonVariants({ size: "sm" })}>
                Open plan
              </Link>
            ) : questionnaireDone ? (
              <Link href="/app/plan" className={buttonVariants({ size: "sm" })}>
                Generate plan
              </Link>
            ) : (
              <Button size="sm" disabled>
                Complete the questionnaire first
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card data-testid="exercises-card">
          <CardHeader>
            <CardTitle>3. Tabletop exercises</CardTitle>
            <CardDescription>
              Run the plan as a fire drill: a scenario, a timer, a decision log and sign-offs, for
              the dated evidence auditors ask for.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveExercise ? (
              <Badge>Live now</Badge>
            ) : exerciseRows.length > 0 ? (
              <Badge variant="secondary">
                {exerciseRows.length} {exerciseRows.length === 1 ? "exercise" : "exercises"}
              </Badge>
            ) : (
              <Badge variant="outline">None yet</Badge>
            )}
            {lastEnded?.ended_at && (
              <p className="text-sm text-muted-foreground">
                Last run {formatDate(lastEnded.ended_at, org.timezone)}. Next due{" "}
                {formatDate(nextTestDue(lastEnded.ended_at)!.toISOString(), org.timezone)}
                {dueState(lastEnded.ended_at) === "overdue" ? ", overdue" : ""}.{" "}
                <Link href="/app/evidence" className="underline underline-offset-4">
                  Evidence vault
                </Link>
              </p>
            )}
          </CardContent>
          <CardFooter>
            {liveExercise ? (
              <Link
                href={`/app/exercises/${liveExercise.id}/run`}
                className={buttonVariants({ size: "sm" })}
              >
                Open the console
              </Link>
            ) : (
              <Link
                href={exerciseRows.length > 0 ? "/app/exercises" : "/app/exercises/new"}
                className={buttonVariants({ size: "sm" })}
              >
                {exerciseRows.length > 0 ? "See exercises" : "Plan an exercise"}
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
