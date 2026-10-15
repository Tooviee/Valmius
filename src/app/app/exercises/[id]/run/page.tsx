import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Console } from "@/components/exercise/console";
import { Poller } from "@/components/exercise/poller";
import { ExerciseStatusBadge } from "@/components/exercise/status-badge";
import { requireOrg } from "@/lib/auth/session";
import { loadExercise } from "@/lib/exercise/load";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Facilitator console",
  robots: { index: false, follow: false },
};

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { org } = await requireOrg();
  const { id } = await params;
  const supabase = await createClient();
  const exercise = await loadExercise(supabase, id);
  if (!exercise) notFound();
  if (exercise.status === "scheduled") redirect(`/app/exercises/${exercise.id}`);

  const pendingSignOffs = exercise.participants.some((p) => !p.signed_off_at);

  return (
    <div className="space-y-6">
      <Poller
        intervalMs={10_000}
        enabled={exercise.status === "live" || (exercise.status === "ended" && pendingSignOffs)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link href="/app/exercises" className="underline-offset-4 hover:underline">
              Exercises
            </Link>{" "}
            /{" "}
            <Link
              href={`/app/exercises/${exercise.id}`}
              className="underline-offset-4 hover:underline"
            >
              {exercise.title}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{exercise.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ExerciseStatusBadge status={exercise.status} />
          <span>
            {exercise.participants.filter((p) => p.attended_at).length}/
            {exercise.participants.length} attending
          </span>
        </div>
      </div>
      <Console exercise={exercise} timeZone={org.timezone} />
    </div>
  );
}
