import type { Metadata } from "next";
import Link from "next/link";
import { ExerciseStatusBadge } from "@/components/exercise/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrg } from "@/lib/auth/session";
import { loadExercises } from "@/lib/exercise/load";
import { SCENARIO_TYPE_LABELS } from "@/lib/schemas/scenario";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Exercises",
  robots: { index: false, follow: false },
};

const formatDateTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(iso),
  );

export default async function ExercisesPage() {
  const { org } = await requireOrg();
  const supabase = await createClient();
  const exercises = await loadExercises(supabase, org.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tabletop exercises"
        description="Each exercise is a dated, facilitated run of a scenario against your plan, with a decision log and findings for the after-action report."
        actions={
          <Link href="/app/exercises/new" className={buttonVariants({ size: "lg" })}>
            New exercise
          </Link>
        }
      />

      {exercises.length === 0 ? (
        <p
          className="rounded-xl border p-6 text-sm text-muted-foreground"
          data-testid="exercises-empty"
        >
          No exercises yet. Create one, share the participant links, and press Start when everyone
          is in the room.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exercise</TableHead>
              <TableHead>Scenario</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Participants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercises.map((exercise) => (
              <TableRow key={exercise.id}>
                <TableCell>
                  <Link
                    href={`/app/exercises/${exercise.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {exercise.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {SCENARIO_TYPE_LABELS[exercise.scenario.type]}
                  {exercise.scenario.is_pack ? "" : " (from your plan)"}
                </TableCell>
                <TableCell>
                  <ExerciseStatusBadge status={exercise.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {exercise.started_at
                    ? formatDateTime(exercise.started_at, org.timezone)
                    : exercise.scheduled_at
                      ? formatDateTime(exercise.scheduled_at, org.timezone)
                      : "Not scheduled"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {exercise.participants.attended}/{exercise.participants.total} attended
                  {exercise.status !== "scheduled" && exercise.status !== "live"
                    ? `, ${exercise.participants.signedOff} signed off`
                    : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
