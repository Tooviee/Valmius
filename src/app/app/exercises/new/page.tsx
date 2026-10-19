import type { Metadata } from "next";
import { NewExerciseForm } from "@/components/exercise/new-exercise-form";
import { requireOrg } from "@/lib/auth/session";
import { loadPacks, loadPlanForExercise } from "@/lib/exercise/load";
import { loadPlanFacts } from "@/lib/plan/load";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "New exercise",
  robots: { index: false, follow: false },
};

// Generating a scenario from the plan is one model call of up to about a minute.
export const maxDuration = 120;

export default async function NewExercisePage() {
  const { org } = await requireOrg();
  const supabase = await createClient();
  const [packs, plan, facts] = await Promise.all([
    loadPacks(supabase),
    loadPlanForExercise(supabase, org.id),
    loadPlanFacts(supabase, org),
  ]);

  const planLabel = plan
    ? `version ${plan.version}${plan.status === "approved" ? " (approved)" : " (draft, not yet approved)"}`
    : "not written yet, so this exercise will not be tied to a plan version";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="New exercise"
        description="Pick the scenario, name the people in the room, and you get a link for each of them."
      />
      <NewExerciseForm packs={packs} canGenerate={facts !== null} planLabel={planLabel} />
    </div>
  );
}
