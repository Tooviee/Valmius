"use client";

import { useActionState, useEffect, useRef } from "react";
import { ScenarioView } from "@/components/scenario/scenario-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTEXT_MAX_LENGTH,
  HEADCOUNT_BANDS,
  HOSTING_LABELS,
  HOSTING_OPTIONS,
  INDUSTRIES,
  INDUSTRY_LABELS,
} from "@/lib/schemas/generator";
import {
  PACK_SCENARIO_TYPES,
  SCENARIO_TYPE_BRIEFS,
  SCENARIO_TYPE_LABELS,
} from "@/lib/schemas/scenario";
import { generateScenarioAction } from "@/server/actions/generate-scenario";
import type { GenerateState, GeneratorFormValues } from "@/server/actions/types";

const EMPTY_VALUES: GeneratorFormValues = {
  industry: "",
  headcountBand: "",
  hosting: [],
  scenarioType: "",
  context: "",
};

const initialState: GenerateState = { status: "idle" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function ScenarioGenerator() {
  const [state, formAction, pending] = useActionState(generateScenarioAction, initialState);
  const resultRef = useRef<HTMLDivElement>(null);

  const values = state.status === "idle" ? EMPTY_VALUES : state.values;
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.status === "ok" || state.status === "rate_limited") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  return (
    <div className="space-y-12">
      <form action={formAction} className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <NativeSelect
              id="industry"
              name="industry"
              required
              defaultValue={values.industry}
              aria-invalid={errors.industry ? true : undefined}
              aria-describedby={errors.industry ? "industry-error" : undefined}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select an industry
              </NativeSelectOption>
              {INDUSTRIES.map((industry) => (
                <NativeSelectOption key={industry} value={industry}>
                  {INDUSTRY_LABELS[industry]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id="industry-error" message={errors.industry} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="headcountBand">Company size</Label>
            <NativeSelect
              id="headcountBand"
              name="headcountBand"
              required
              defaultValue={values.headcountBand}
              aria-invalid={errors.headcountBand ? true : undefined}
              aria-describedby={errors.headcountBand ? "headcountBand-error" : undefined}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a size
              </NativeSelectOption>
              {HEADCOUNT_BANDS.map((band) => (
                <NativeSelectOption key={band} value={band}>
                  {band} employees
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id="headcountBand-error" message={errors.headcountBand} />
          </div>
        </div>

        <fieldset
          className="space-y-3"
          aria-describedby={errors.hosting ? "hosting-error" : "hosting-hint"}
        >
          <legend className="text-sm font-medium">Where do your systems run?</legend>
          <p id="hosting-hint" className="text-sm text-muted-foreground">
            Choose all that apply.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {HOSTING_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="checkbox"
                  name="hosting"
                  value={option}
                  defaultChecked={values.hosting.includes(option)}
                  className="size-4 accent-primary outline-none"
                />
                {HOSTING_LABELS[option]}
              </label>
            ))}
          </div>
          <FieldError id="hosting-error" message={errors.hosting} />
        </fieldset>

        <fieldset
          className="space-y-3"
          aria-describedby={errors.scenarioType ? "scenarioType-error" : undefined}
        >
          <legend className="text-sm font-medium">Scenario type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PACK_SCENARIO_TYPES.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="radio"
                  name="scenarioType"
                  value={type}
                  required
                  defaultChecked={values.scenarioType === type}
                  className="mt-0.5 size-4 accent-primary outline-none"
                />
                <span className="space-y-1">
                  <span className="block font-medium">{SCENARIO_TYPE_LABELS[type]}</span>
                  <span className="block text-muted-foreground">{SCENARIO_TYPE_BRIEFS[type]}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="scenarioType-error" message={errors.scenarioType} />
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="context">
            Anything else we should know? <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="context"
            name="context"
            rows={3}
            maxLength={CONTEXT_MAX_LENGTH}
            defaultValue={values.context}
            placeholder="For example: the tools your team relies on, or who handles IT."
            aria-invalid={errors.context ? true : undefined}
            aria-describedby={errors.context ? "context-error" : "context-hint"}
          />
          <p id="context-hint" className="text-sm text-muted-foreground">
            Up to {CONTEXT_MAX_LENGTH} characters. Leave out names, health data and card numbers.
          </p>
          <FieldError id="context-error" message={errors.context} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Writing your scenario..." : "Generate scenario"}
          </Button>
          {pending && (
            <p role="status" className="text-sm text-muted-foreground">
              This can take up to a minute.
            </p>
          )}
        </div>
      </form>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-8">
        {!pending && state.status === "rate_limited" && (
          <Alert>
            <AlertTitle>You have reached the limit for now</AlertTitle>
            <AlertDescription>
              The free generator allows 5 scenarios per hour. Please try again a little later.
            </AlertDescription>
          </Alert>
        )}
        {!pending && state.status === "ok" && <ScenarioView scenario={state.scenario} />}
      </div>
    </div>
  );
}
