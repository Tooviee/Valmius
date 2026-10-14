import type { Metadata } from "next";
import Link from "next/link";
import { QuestionnaireProgress } from "@/components/questionnaire/progress";
import { QuestionnaireStepForm } from "@/components/questionnaire/step-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOrg } from "@/lib/auth/session";
import {
  isStepComplete,
  parseStep,
  QUESTIONNAIRE_STEPS,
  questionnaireDraftSchema,
  type QuestionnaireStep,
} from "@/lib/schemas/questionnaire";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Questionnaire",
  robots: { index: false, follow: false },
};

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; incomplete?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;
  const step = parseStep(params.step);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questionnaires")
    .select("answers, completed_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the questionnaire: ${error.message}`);

  // Stored answers always passed the draft schema; parse again so a stale shape cannot crash the page.
  const answers = questionnaireDraftSchema.safeParse(data?.answers ?? {}).data ?? {};
  const complete = Object.fromEntries(
    QUESTIONNAIRE_STEPS.map((s) => [s.step, isStepComplete(s.step, answers)]),
  ) as Record<QuestionnaireStep, boolean>;
  const timeZones = [...Intl.supportedValuesOf("timeZone"), "UTC"].sort();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Questionnaire</h1>
        <p className="text-muted-foreground">
          Fifteen questions in five short steps. The plan is written from these answers, so the more
          specific they are, the more useful the plan.
        </p>
      </div>

      {data?.completed_at && (
        <Alert data-testid="questionnaire-complete">
          <AlertTitle>Questionnaire complete</AlertTitle>
          <AlertDescription>
            You can keep editing answers here. When you are ready, generate the plan.
          </AlertDescription>
          <div className="mt-2">
            <Button render={<Link href="/app/plan" />} size="sm">
              Go to the plan
            </Button>
          </div>
        </Alert>
      )}
      {params.incomplete && !data?.completed_at && (
        <Alert variant="destructive">
          <AlertTitle>A step still needs answers</AlertTitle>
          <AlertDescription>
            We brought you to the first step that is not finished yet.
          </AlertDescription>
        </Alert>
      )}

      <QuestionnaireProgress current={step} complete={complete} />

      <QuestionnaireStepForm
        key={step}
        step={step}
        answers={answers}
        org={{
          name: org.name,
          industry: org.industry,
          headcountBand: org.headcount_band,
          frameworks: org.frameworks,
          timezone: org.timezone,
        }}
        timeZones={timeZones}
      />
    </div>
  );
}
