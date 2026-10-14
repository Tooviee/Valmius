"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef } from "react";
import type { OrganizationFieldValues } from "@/components/app/organization-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  LAST_STEP,
  QUESTIONNAIRE_STEPS,
  type QuestionnaireDraft,
  type QuestionnaireStep,
} from "@/lib/schemas/questionnaire";
import { saveQuestionnaireStepAction } from "@/server/actions/questionnaire";
import type { QuestionnaireState } from "@/server/actions/types";
import { StepCompany, StepDefenses, StepObligations, StepPeople, StepSystems } from "./steps";

const AUTOSAVE_DELAY_MS = 1500;
const initialState: QuestionnaireState = { status: "idle" };

const STEP_COMPONENTS = {
  1: StepCompany,
  2: StepSystems,
  3: StepPeople,
  4: StepDefenses,
  5: StepObligations,
} as const;

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(iso));

/**
 * One step of the questionnaire. Every change is saved after a short pause (autosave);
 * "Save and continue" saves again, checks the step is complete and moves on.
 */
export function QuestionnaireStepForm({
  step,
  answers,
  org,
  timeZones,
}: {
  step: QuestionnaireStep;
  answers: QuestionnaireDraft;
  org: OrganizationFieldValues;
  timeZones: string[];
}) {
  const boundAction = useMemo(() => saveQuestionnaireStepAction.bind(null, step), [step]);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dispatch = (intent: "autosave" | "next") => {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    formData.set("intent", intent);
    startTransition(() => formAction(formData));
  };

  const scheduleAutosave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dispatch("autosave"), AUTOSAVE_DELAY_MS);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const savedAt =
    state.status === "saved" ? state.savedAt : state.status === "invalid" ? state.savedAt : null;
  const meta = QUESTIONNAIRE_STEPS[step - 1];
  const Fields = STEP_COMPONENTS[step];

  return (
    <form
      ref={formRef}
      onChange={scheduleAutosave}
      onSubmit={(event) => {
        event.preventDefault();
        clearTimeout(timer.current);
        dispatch("next");
      }}
      className="space-y-8"
      aria-describedby="save-status"
      data-testid="questionnaire-step"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Step {step} of {LAST_STEP}: {meta.title}
        </h2>
        <p id="save-status" role="status" className="text-sm text-muted-foreground">
          {pending
            ? "Saving..."
            : state.status === "error"
              ? "Could not save. Check your connection and try again."
              : savedAt
                ? `Saved at ${formatTime(savedAt)}`
                : "Answers save automatically as you type."}
        </p>
      </div>

      <Fields answers={answers} org={org} timeZones={timeZones} errors={errors} />

      {state.status === "invalid" && (
        <Alert variant="destructive">
          <AlertTitle>A few answers need attention</AlertTitle>
          <AlertDescription>
            Your progress is saved. Fix the highlighted fields to continue.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {step > 1 ? (
          <Link
            href={`/app/questionnaire?step=${step - 1}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back
          </Link>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {step < LAST_STEP ? "Save and continue" : "Finish questionnaire"}
        </Button>
      </div>
    </form>
  );
}
