import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/exercise/copy-link-button";
import { ExerciseStatusBadge } from "@/components/exercise/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrg } from "@/lib/auth/session";
import { loadExercise } from "@/lib/exercise/load";
import { participantPath } from "@/lib/exercise/token";
import { FINDING_KIND_LABELS, FINDING_KINDS } from "@/lib/schemas/exercise";
import { SCENARIO_TYPE_LABELS } from "@/lib/schemas/scenario";
import { createClient } from "@/lib/supabase/server";
import { deleteExerciseAction, startExerciseAction } from "@/server/actions/exercise";

export const metadata: Metadata = {
  title: "Exercise",
  robots: { index: false, follow: false },
};

const formatDateTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(iso),
  );

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { org } = await requireOrg();
  const { id } = await params;
  const supabase = await createClient();
  const exercise = await loadExercise(supabase, id);
  if (!exercise) notFound();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const scenario = exercise.scenario.content;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/app/exercises" className="underline-offset-4 hover:underline">
              Exercises
            </Link>{" "}
            / {exercise.title}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{exercise.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ExerciseStatusBadge status={exercise.status} />
            <span>
              {SCENARIO_TYPE_LABELS[exercise.scenario.type]}: {scenario.title}
              {exercise.scenario.is_pack ? "" : " (generated from your plan)"}
            </span>
            {exercise.scheduled_at && (
              <span>· Scheduled {formatDateTime(exercise.scheduled_at, org.timezone)}</span>
            )}
            {exercise.started_at && (
              <span>· Started {formatDateTime(exercise.started_at, org.timezone)}</span>
            )}
            {exercise.ended_at && (
              <span>· Ended {formatDateTime(exercise.ended_at, org.timezone)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exercise.status === "scheduled" && (
            <>
              <form action={deleteExerciseAction}>
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <Button type="submit" variant="outline" size="sm">
                  Discard
                </Button>
              </form>
              <form action={startExerciseAction}>
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <Button type="submit" size="lg" data-testid="start-exercise">
                  Start exercise
                </Button>
              </form>
            </>
          )}
          {exercise.status === "live" && (
            <Link
              href={`/app/exercises/${exercise.id}/run`}
              className={buttonVariants({ size: "lg" })}
            >
              Open the console
            </Link>
          )}
          {(exercise.status === "ended" || exercise.status === "reported") && (
            <Link
              href={`/app/exercises/${exercise.id}/run`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Review the log
            </Link>
          )}
        </div>
      </div>

      {exercise.plan ? (
        exercise.plan.status === "draft" && (
          <Alert>
            <AlertTitle>
              Tests plan version {exercise.plan.version}, which is not approved yet
            </AlertTitle>
            <AlertDescription>
              The after-action report will cite a draft. Approve the plan before the exercise if the
              record needs to show an approved version.
            </AlertDescription>
          </Alert>
        )
      ) : (
        <Alert>
          <AlertTitle>No plan version attached</AlertTitle>
          <AlertDescription>
            The organization had no written plan when this exercise was created.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Participants</h2>
        <p className="text-sm text-muted-foreground">
          Send each person their link however you normally reach them. The link works on a phone,
          shows them the current step, and takes their sign-off at the end.
        </p>
        {exercise.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No participants were added.</p>
        ) : (
          <Table data-testid="participants">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Attended</TableHead>
                <TableHead>Signed off</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercise.participants.map((participant) => {
                const url = `${siteUrl}${participantPath(participant.token)}`;
                return (
                  <TableRow key={participant.id} data-testid="participant-row">
                    <TableCell>
                      <span className="font-medium">{participant.name}</span>
                      {participant.email && (
                        <span className="block text-xs text-muted-foreground">
                          {participant.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{participant.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {participant.attended_at
                        ? formatDateTime(participant.attended_at, org.timezone)
                        : "Not yet"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {participant.signed_off_at
                        ? `${participant.signature_name}, ${formatDateTime(participant.signed_off_at, org.timezone)}`
                        : "Not yet"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code
                          className="max-w-48 truncate text-xs"
                          title={url}
                          data-testid="participant-link"
                        >
                          {url}
                        </code>
                        <CopyLinkButton url={url} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border p-5">
          <h2 className="text-base font-semibold">Scenario</h2>
          <p className="text-sm text-muted-foreground">{scenario.summary}</p>
          <p className="text-sm text-muted-foreground">
            {scenario.injects.length} injects, about {scenario.estimated_duration_minutes} minutes.
          </p>
        </div>
        {exercise.status !== "scheduled" && (
          <div className="space-y-2 rounded-xl border p-5" data-testid="exercise-summary">
            <h2 className="text-base font-semibold">So far</h2>
            <p className="text-sm text-muted-foreground">
              {exercise.revealed_count} of {scenario.injects.length} injects revealed,{" "}
              {exercise.decisions.length} decisions logged.
            </p>
            <ul className="text-sm text-muted-foreground">
              {FINDING_KINDS.map((kind) => (
                <li key={kind}>
                  {FINDING_KIND_LABELS[kind]}s:{" "}
                  {exercise.findings.filter((f) => f.kind === kind).length}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
