"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParticipantView as View } from "@/lib/exercise/participant";
import { formatOffset } from "@/lib/exercise/timer";
import { confirmAttendanceAction, signOffAction } from "@/server/actions/participant";
import type { ParticipantActionState } from "@/server/actions/types";

const idle: ParticipantActionState = { status: "idle" };

function ActionMessage({ state }: { state: ParticipantActionState }) {
  const message =
    state.status === "invalid"
      ? state.message
      : state.status === "invalid_link"
        ? "This link is no longer valid."
        : state.status === "rate_limited"
          ? "Too many attempts. Please wait a minute."
          : state.status === "error"
            ? "Something went wrong. Please try again."
            : null;
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function ParticipantView({ view, token }: { view: View; token: string }) {
  const [attend, attendAction, attending] = useActionState(confirmAttendanceAction, idle);
  const [sign, signAction, signing] = useActionState(signOffAction, idle);
  const { participant, exercise, scenario, injects } = view;
  const ended = exercise.status === "ended" || exercise.status === "reported";
  const current = injects.at(-1);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Tabletop exercise</p>
        <h1 className="text-2xl font-semibold tracking-tight">{exercise.title}</h1>
        <p className="text-sm text-muted-foreground" data-testid="participant-identity">
          You are <span className="font-medium text-foreground">{participant.name}</span>, playing{" "}
          <span className="font-medium text-foreground">{participant.role}</span>.
        </p>
      </div>

      {!participant.attended_at && !ended && (
        <form
          action={attendAction}
          className="space-y-2 rounded-xl border p-4"
          data-testid="attendance"
        >
          <input type="hidden" name="token" value={token} />
          <p className="text-sm">Confirm you are here so the record shows who took part.</p>
          <Button type="submit" disabled={attending}>
            {attending ? "Confirming..." : "I'm here"}
          </Button>
          <ActionMessage state={attend} />
        </form>
      )}
      {participant.attended_at && !ended && (
        <p className="text-sm text-muted-foreground" data-testid="attended">
          Attendance confirmed. This page updates by itself.
        </p>
      )}

      {exercise.status === "scheduled" && (
        <Alert>
          <AlertTitle>Waiting for the facilitator to start</AlertTitle>
          <AlertDescription>{scenario.summary}</AlertDescription>
        </Alert>
      )}

      {exercise.status === "live" && !current && (
        <Alert>
          <AlertTitle>The exercise has started</AlertTitle>
          <AlertDescription>
            The first step will appear here when the facilitator reveals it. {scenario.day_and_time}
          </AlertDescription>
        </Alert>
      )}

      {current && (
        <section className="space-y-3 rounded-xl border p-5" data-testid="participant-inject">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Step {exercise.revealed_count} of {exercise.total_injects} ·{" "}
            {formatOffset(current.offset_minutes)}
          </p>
          <h2 className="text-lg font-semibold">{current.title}</h2>
          <p className="text-sm leading-relaxed">{current.narrative}</p>
          <div>
            <p className="text-sm font-medium">Discuss</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {current.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {injects.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Earlier steps</summary>
          <ol className="mt-2 space-y-2">
            {injects.slice(0, -1).map((inject) => (
              <li key={inject.index} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {formatOffset(inject.offset_minutes)}
                </p>
                <p className="font-medium">{inject.title}</p>
                <p className="text-muted-foreground">{inject.narrative}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      {view.wrapUpQuestions.length > 0 && (
        <section className="space-y-2 rounded-xl border p-5">
          <h2 className="text-base font-semibold">Wrap-up</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {view.wrapUpQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      {ended &&
        (participant.signed_off_at ? (
          <Alert data-testid="signed-off">
            <AlertTitle>Signed off</AlertTitle>
            <AlertDescription>
              Recorded as {participant.signature_name}. Thank you, you can close this page.
            </AlertDescription>
          </Alert>
        ) : (
          <form
            action={signAction}
            className="space-y-3 rounded-xl border p-5"
            data-testid="signoff-form"
          >
            <input type="hidden" name="token" value={token} />
            <h2 className="text-base font-semibold">The exercise has ended. Please sign off.</h2>
            <p className="text-sm text-muted-foreground">
              Typing your name confirms you took part in this exercise. It appears on the
              after-action report.
            </p>
            <div className="space-y-1">
              <Label htmlFor="signatureName">Your full name</Label>
              <Input
                id="signatureName"
                name="signatureName"
                required
                maxLength={120}
                defaultValue={participant.name}
                autoComplete="name"
              />
            </div>
            <Button type="submit" disabled={signing}>
              {signing ? "Signing..." : "Sign off"}
            </Button>
            <ActionMessage state={sign} />
          </form>
        ))}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Who is in the room</summary>
        <ul className="mt-2 list-disc pl-5">
          {view.roster.map((p) => (
            <li key={`${p.name}-${p.role}`}>
              {p.name} <span className="text-muted-foreground">({p.role})</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
