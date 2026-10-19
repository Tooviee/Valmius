"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { cn } from "cn";
import { ExerciseTimer } from "@/components/exercise/timer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DecisionEntry, ExerciseRecord, Finding } from "@/lib/exercise/load";
import { formatOffset, injectStates } from "@/lib/exercise/timer";
import {
  DECISION_MAX_LENGTH,
  FINDING_KIND_LABELS,
  FINDING_KINDS,
  PARKING_LOT_MAX_LENGTH,
  SEVERITIES,
  TEAM_ACTOR,
  type FindingKind,
} from "@/lib/schemas/exercise";
import { SCENARIO_TYPE_LABELS } from "@/lib/schemas/scenario";
import {
  addFindingAction,
  deleteDecisionAction,
  deleteFindingAction,
  endExerciseAction,
  logDecisionAction,
  revealInjectAction,
  saveParkingLotAction,
  updateDecisionAction,
} from "@/server/actions/console";
import type { ConsoleFormState, ParkingLotState } from "@/server/actions/types";

const idle: ConsoleFormState = { status: "idle" };
const FACILITATOR_ACTOR = "Facilitator";

// Under lg the three columns become one at a time, chosen from a bar of buttons.
type Panel = "scenario" | "log" | "controls";
const PANELS: { id: Panel; label: string }[] = [
  { id: "scenario", label: "Scenario" },
  { id: "log", label: "Log" },
  { id: "controls", label: "Controls" },
];

const formatTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone }).format(new Date(iso));

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid={testId}>
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DecisionForm({
  exercise,
  injectIndex,
}: {
  exercise: ExerciseRecord;
  injectIndex: number | null;
}) {
  const [state, formAction, pending] = useActionState(logDecisionAction, idle);
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  return (
    <form action={formAction} className="space-y-3" data-testid="decision-form">
      <input type="hidden" name="exerciseId" value={exercise.id} />
      <input type="hidden" name="injectIndex" value={injectIndex ?? ""} />
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-1">
          <Label htmlFor="actorName">Who decided</Label>
          <NativeSelect
            id="actorName"
            name="actorName"
            defaultValue={TEAM_ACTOR}
            className="w-full"
          >
            <NativeSelectOption value={TEAM_ACTOR}>{TEAM_ACTOR}</NativeSelectOption>
            {exercise.participants.map((p) => (
              <NativeSelectOption key={p.id} value={p.name}>
                {p.name} ({p.role})
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={FACILITATOR_ACTOR}>{FACILITATOR_ACTOR}</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="decision">Decision</Label>
          <Input
            id="decision"
            name="decision"
            required
            maxLength={DECISION_MAX_LENGTH}
            placeholder="What was decided, in one sentence"
            aria-invalid={errors.decision ? true : undefined}
          />
          {errors.decision && <p className="text-sm text-destructive">{errors.decision}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={DECISION_MAX_LENGTH}
          placeholder="Who does it, by when, open questions"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Logging..." : "Log decision"}
        </Button>
        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
        <p role="status" className="sr-only">
          {state.status === "ok" ? "Decision logged." : ""}
        </p>
      </div>
    </form>
  );
}

function DecisionRow({
  entry,
  exercise,
  timeZone,
  readOnly,
}: {
  entry: DecisionEntry;
  exercise: ExerciseRecord;
  timeZone: string;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: ConsoleFormState, formData: FormData) => {
      const result = await updateDecisionAction(previous, formData);
      if (result.status === "ok") setEditing(false);
      return result;
    },
    idle,
  );

  const injectLabel = entry.inject_index === null ? "General" : `Inject ${entry.inject_index + 1}`;

  if (editing) {
    return (
      <li className="rounded-lg border p-3">
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <input type="hidden" name="decisionId" value={entry.id} />
          <Input
            name="decision"
            defaultValue={entry.decision}
            required
            maxLength={DECISION_MAX_LENGTH}
            aria-label="Decision"
          />
          <Textarea
            name="notes"
            defaultValue={entry.notes}
            rows={2}
            maxLength={DECISION_MAX_LENGTH}
            aria-label="Notes"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {state.status === "error" && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border p-3 text-sm" data-testid="decision-entry">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{formatTime(entry.logged_at, timeZone)}</span> · {injectLabel}{" "}
          · <span className="font-medium text-foreground">{entry.actor_name}</span>
        </p>
        {!readOnly && (
          <div className="flex gap-1">
            <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <form action={deleteDecisionAction}>
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <input type="hidden" name="decisionId" value={entry.id} />
              <Button type="submit" size="xs" variant="ghost">
                Delete
              </Button>
            </form>
          </div>
        )}
      </div>
      <p className="mt-1">{entry.decision}</p>
      {entry.notes && <p className="mt-1 text-muted-foreground">{entry.notes}</p>}
    </li>
  );
}

function FindingQuickAdd({ exercise }: { exercise: ExerciseRecord }) {
  const [kind, setKind] = useState<FindingKind | null>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: ConsoleFormState, formData: FormData) => {
      const result = await addFindingAction(previous, formData);
      if (result.status === "ok") setKind(null);
      return result;
    },
    idle,
  );
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FINDING_KINDS.map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={kind === k ? "default" : "outline"}
            onClick={() => setKind((current) => (current === k ? null : k))}
            data-testid={`add-${k}`}
          >
            + {FINDING_KIND_LABELS[k]}
          </Button>
        ))}
      </div>
      {kind && (
        <form
          action={formAction}
          className="space-y-2 rounded-lg border bg-muted/40 p-3"
          data-testid="finding-form"
        >
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <input type="hidden" name="kind" value={kind} />
          <Textarea
            name="description"
            rows={2}
            required
            maxLength={DECISION_MAX_LENGTH}
            placeholder={`Describe the ${FINDING_KIND_LABELS[kind].toLowerCase()}`}
            aria-label="Description"
            aria-invalid={errors.description ? true : undefined}
          />
          {kind === "gap" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="severity">Severity</Label>
              <NativeSelect id="severity" name="severity" defaultValue="medium" size="sm">
                {SEVERITIES.map((s) => (
                  <NativeSelectOption key={s} value={s}>
                    {s}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.severity && <p className="text-sm text-destructive">{errors.severity}</p>}
            </div>
          )}
          {kind === "action_item" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                name="ownerName"
                placeholder="Owner (role or name)"
                maxLength={120}
                aria-label="Owner"
              />
              <Input name="dueDate" type="date" aria-label="Due date" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding..." : `Add ${FINDING_KIND_LABELS[kind].toLowerCase()}`}
            </Button>
            {state.status === "error" && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function FindingsList({
  findings,
  exercise,
  readOnly,
}: {
  findings: Finding[];
  exercise: ExerciseRecord;
  readOnly: boolean;
}) {
  if (findings.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing captured yet.</p>;
  return (
    <ul className="space-y-2" data-testid="findings">
      {findings.map((finding) => (
        <li
          key={finding.id}
          className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-sm"
          data-testid={`finding-${finding.kind}`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  finding.kind === "gap"
                    ? "destructive"
                    : finding.kind === "strength"
                      ? "secondary"
                      : "outline"
                }
              >
                {FINDING_KIND_LABELS[finding.kind]}
              </Badge>
              {finding.severity && <Badge variant="outline">{finding.severity}</Badge>}
            </div>
            <p>{finding.description}</p>
            {(finding.owner_name || finding.due_date) && (
              <p className="text-xs text-muted-foreground">
                {finding.owner_name}
                {finding.owner_name && finding.due_date ? ", due " : finding.due_date ? "Due " : ""}
                {finding.due_date}
              </p>
            )}
          </div>
          {!readOnly && (
            <form action={deleteFindingAction}>
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <input type="hidden" name="findingId" value={finding.id} />
              <Button type="submit" size="xs" variant="ghost" aria-label="Remove finding">
                Remove
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

function ParkingLot({ exercise, readOnly }: { exercise: ExerciseRecord; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState(saveParkingLotAction, {
    status: "idle",
  } as ParkingLotState);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      startTransition(() => formAction(new FormData(form)));
    }, 1500);
  };

  return (
    <form
      ref={formRef}
      onChange={schedule}
      onSubmit={(e) => e.preventDefault()}
      className="space-y-2"
    >
      <input type="hidden" name="exerciseId" value={exercise.id} />
      <Textarea
        name="parkingLot"
        rows={4}
        maxLength={PARKING_LOT_MAX_LENGTH}
        defaultValue={exercise.parking_lot}
        readOnly={readOnly}
        placeholder="Questions to come back to, things to look up after the exercise"
        aria-label="Parking lot"
      />
      <p className="text-xs text-muted-foreground" role="status">
        {pending
          ? "Saving..."
          : state.status === "saved"
            ? "Saved"
            : state.status === "error"
              ? "Could not save"
              : readOnly
                ? ""
                : "Saves as you type."}
      </p>
    </form>
  );
}

function EndExercise({ exercise }: { exercise: ExerciseRecord }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={() => setConfirming(true)}
        data-testid="end-exercise"
      >
        End exercise
      </Button>
    );
  }
  return (
    <form
      action={endExerciseAction}
      className="space-y-2 rounded-lg border border-destructive/40 p-3"
    >
      <input type="hidden" name="exerciseId" value={exercise.id} />
      <p className="text-sm">
        Ending locks the decision log and opens sign-off for participants. Findings can still be
        added during the debrief.
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" data-testid="confirm-end">
          Yes, end it
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Keep going
        </Button>
      </div>
    </form>
  );
}

/** The facilitator console (SPEC.md section 7, Phase 3): scenario, log, timer and findings. */
export function Console({ exercise, timeZone }: { exercise: ExerciseRecord; timeZone: string }) {
  const scenario = exercise.scenario.content;
  const live = exercise.status === "live";
  const readOnly = !live;
  const current =
    exercise.revealed_count > 0 ? scenario.injects[exercise.revealed_count - 1] : null;
  const allRevealed = exercise.revealed_count >= scenario.injects.length;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [live]);
  const [panel, setPanel] = useState<Panel>("scenario");
  const panelClass = (id: Panel) => cn("space-y-4", panel !== id && "hidden lg:block");
  const states = injectStates(
    scenario.injects,
    exercise.revealed_count,
    exercise.started_at
      ? Math.max(
          0,
          (exercise.ended_at ? new Date(exercise.ended_at) : now).getTime() -
            new Date(exercise.started_at).getTime(),
        )
      : 0,
  );

  return (
    <div className="space-y-6">
      {readOnly && (
        <Alert data-testid="ended-banner">
          <AlertTitle>This exercise has ended</AlertTitle>
          <AlertDescription>
            The decision log is locked. Participants can sign off from their links; findings can
            still be added for the debrief.
          </AlertDescription>
        </Alert>
      )}

      <div
        role="group"
        aria-label="Console sections"
        className="sticky top-0 z-10 -mx-6 flex gap-1 border-b bg-background/95 px-6 py-2 backdrop-blur lg:hidden"
        data-testid="console-tabs"
      >
        {PANELS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={panel === p.id ? "default" : "ghost"}
            aria-pressed={panel === p.id}
            aria-controls={`console-${p.id}`}
            onClick={() => setPanel(p.id)}
            data-testid={`tab-${p.id}`}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr_1fr]">
        {/* Left: scenario and current inject */}
        <div id="console-scenario" className={panelClass("scenario")}>
          <Section title="Scenario">
            <p className="font-medium">{scenario.title}</p>
            <p className="text-sm text-muted-foreground">
              {SCENARIO_TYPE_LABELS[exercise.scenario.type]} · about{" "}
              {scenario.estimated_duration_minutes} minutes
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Setting and roles</summary>
              <div className="mt-2 space-y-2">
                <p>
                  <span className="font-medium">Company:</span> {scenario.setting.company_profile}
                </p>
                <p>
                  <span className="font-medium">When:</span> {scenario.setting.day_and_time}
                </p>
                <p>
                  <span className="font-medium">First sign:</span> {scenario.setting.initial_signal}
                </p>
                <ul className="list-disc pl-5">
                  {scenario.roles.map((role) => (
                    <li key={role.name}>
                      <span className="font-medium">{role.name}:</span> {role.responsibilities}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </Section>
          <Section
            title={
              current
                ? `Inject ${exercise.revealed_count} of ${scenario.injects.length}`
                : "Current inject"
            }
            testId="current-inject"
          >
            {current ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {formatOffset(current.offset_minutes)}
                </p>
                <h3 className="text-lg font-semibold">{current.title}</h3>
                <p className="text-sm leading-relaxed">{current.narrative}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Read the setting aloud, then reveal the first inject when the room is ready.
              </p>
            )}
          </Section>
          {(allRevealed || readOnly) && (
            <Section title="Wrap-up questions">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {scenario.wrap_up_questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </Section>
          )}
        </div>

        {/* Center: questions and decision log */}
        <div id="console-log" className={panelClass("log")}>
          {current && (
            <Section title="Discussion">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {current.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Expected actions (facilitator only)
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {current.expected_actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {current.framework_refs.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Evidence toward: {current.framework_refs.join(", ")}
                  </p>
                )}
              </details>
            </Section>
          )}
          <Section title="Decision log" testId="decision-log">
            {live && (
              <DecisionForm
                exercise={exercise}
                injectIndex={current ? exercise.revealed_count - 1 : null}
              />
            )}
            {exercise.decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions logged yet.</p>
            ) : (
              <ol className="space-y-2">
                {exercise.decisions.map((entry) => (
                  <DecisionRow
                    key={entry.id}
                    entry={entry}
                    exercise={exercise}
                    timeZone={timeZone}
                    readOnly={readOnly}
                  />
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Right: timer, injects, findings, parking lot, end */}
        <div id="console-controls" className={panelClass("controls")}>
          <Section title="Timer">
            {exercise.started_at ? (
              <ExerciseTimer
                startedAt={exercise.started_at}
                endedAt={exercise.ended_at}
                injects={scenario.injects}
                revealedCount={exercise.revealed_count}
              />
            ) : null}
          </Section>
          <Section title="Injects" testId="inject-list">
            <ol className="space-y-1.5 text-sm">
              {scenario.injects.map((inject, index) => (
                <li
                  key={index}
                  className="flex items-baseline justify-between gap-2"
                  data-state={states[index]}
                >
                  <span className={states[index] === "upcoming" ? "text-muted-foreground" : ""}>
                    {index + 1}. {inject.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {states[index] === "revealed"
                      ? exercise.reveal_times[index]
                        ? formatTime(exercise.reveal_times[index], timeZone)
                        : "shown"
                      : states[index] === "due"
                        ? "due"
                        : formatOffset(inject.offset_minutes)}
                  </span>
                </li>
              ))}
            </ol>
            {live && (
              <form action={revealInjectAction}>
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={allRevealed}
                  data-testid="reveal-next"
                >
                  {allRevealed
                    ? "All injects revealed"
                    : exercise.revealed_count === 0
                      ? "Reveal first inject"
                      : "Reveal next inject"}
                </Button>
              </form>
            )}
          </Section>
          <Section title="Findings" testId="findings-section">
            {!readOnly || exercise.status === "ended" ? (
              <FindingQuickAdd exercise={exercise} />
            ) : null}
            <FindingsList
              findings={exercise.findings}
              exercise={exercise}
              readOnly={exercise.status === "reported"}
            />
          </Section>
          <Section title="Parking lot">
            <ParkingLot exercise={exercise} readOnly={readOnly} />
          </Section>
          {live && <EndExercise exercise={exercise} />}
          {readOnly && (
            <Section title="Sign-off" testId="signoff-roster">
              <ul className="space-y-1 text-sm">
                {exercise.participants.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {p.name} <span className="text-muted-foreground">({p.role})</span>
                    </span>
                    <span className="text-muted-foreground">
                      {p.signed_off_at
                        ? `Signed ${formatTime(p.signed_off_at, timeZone)}`
                        : p.attended_at
                          ? "Attended, not signed"
                          : "Did not attend"}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
