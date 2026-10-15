"use client";

import { useActionState, useState } from "react";
import { FieldError, Hint, TextField } from "@/components/questionnaire/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PackOption } from "@/lib/exercise/load";
import { FOCUS_MAX_LENGTH, MAX_PARTICIPANTS } from "@/lib/schemas/exercise";
import {
  PACK_SCENARIO_TYPES,
  SCENARIO_TYPE_BRIEFS,
  SCENARIO_TYPE_LABELS,
  type ScenarioType,
} from "@/lib/schemas/scenario";
import { createExerciseAction } from "@/server/actions/exercise";
import type { CreateExerciseState, CreateExerciseValues } from "@/server/actions/types";

const EMPTY_ROW = { name: "", email: "", role: "" };
const EMPTY_VALUES: CreateExerciseValues = {
  title: "",
  scheduledAt: "",
  sourceKind: "pack",
  packId: "",
  scenarioType: "ransomware",
  focus: "",
  participants: [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW],
};
const initialState: CreateExerciseState = { status: "idle" };

const optionClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

/** Local wall time from a datetime-local input, as an ISO instant; empty when unset or invalid. */
function toIso(local: string): string {
  if (!local) return "";
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function NewExerciseForm({
  packs,
  canGenerate,
  planLabel,
}: {
  packs: PackOption[];
  canGenerate: boolean;
  planLabel: string;
}) {
  const [state, formAction, pending] = useActionState(createExerciseAction, initialState);
  const values = state.status === "idle" ? EMPTY_VALUES : state.values;
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  const [sourceKind, setSourceKind] = useState<"pack" | "generate">(values.sourceKind);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [rows, setRows] = useState(
    values.participants.length > 0 ? values.participants : [EMPTY_ROW],
  );

  const packsByType = PACK_SCENARIO_TYPES.map((type) => ({
    type,
    packs: packs.filter((pack) => pack.type === type),
  }));

  return (
    <form action={formAction} className="space-y-10">
      <section className="space-y-5">
        <TextField
          name="title"
          label="Exercise title"
          required
          maxLength={200}
          defaultValue={values.title}
          placeholder="e.g. Q4 2026 ransomware tabletop"
          error={errors.title}
        />
        <div className="space-y-2">
          <Label htmlFor="scheduledLocal">
            Date and time <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="scheduledLocal"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(event) => setScheduledLocal(event.target.value)}
            className="max-w-xs"
          />
          <input type="hidden" name="scheduledAt" value={toIso(scheduledLocal)} />
          <Hint id="scheduledLocal-hint">
            In your browser&apos;s time zone. The exercise starts when you press Start, whatever the
            date says.
          </Hint>
          <FieldError id="scheduledAt-error" message={errors.scheduledAt} />
        </div>
      </section>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Scenario</legend>
        <p className="text-sm text-muted-foreground">
          The plan being tested is {planLabel}. A scenario generated from it names your systems,
          roles and obligations; a pack is generic but instant.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={optionClass}>
            <input
              type="radio"
              name="sourceKind"
              value="pack"
              checked={sourceKind === "pack"}
              onChange={() => setSourceKind("pack")}
              className="mt-0.5 size-4 accent-primary outline-none"
            />
            <span className="space-y-1">
              <span className="block font-medium">Use a scenario pack</span>
              <span className="block text-muted-foreground">
                Twelve ready-made scenarios, three per incident type.
              </span>
            </span>
          </label>
          <label className={optionClass} aria-disabled={!canGenerate}>
            <input
              type="radio"
              name="sourceKind"
              value="generate"
              checked={sourceKind === "generate"}
              disabled={!canGenerate}
              onChange={() => setSourceKind("generate")}
              className="mt-0.5 size-4 accent-primary outline-none"
            />
            <span className="space-y-1">
              <span className="block font-medium">Generate from my plan</span>
              <span className="block text-muted-foreground">
                {canGenerate
                  ? "Written for your company from the questionnaire. Takes about a minute."
                  : "Finish the questionnaire first."}
              </span>
            </span>
          </label>
        </div>

        {sourceKind === "pack" ? (
          <div className="space-y-2">
            <Label htmlFor="packId">Scenario pack</Label>
            <NativeSelect
              id="packId"
              name="packId"
              required
              defaultValue={values.packId}
              aria-invalid={errors["source.scenarioId"] ? true : undefined}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Choose a pack
              </NativeSelectOption>
              {packsByType.map((group) => (
                <NativeSelectOptGroup
                  key={group.type}
                  label={SCENARIO_TYPE_LABELS[group.type as ScenarioType]}
                >
                  {group.packs.map((pack) => (
                    <NativeSelectOption key={pack.id} value={pack.id}>
                      {pack.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
            <FieldError id="packId-error" message={errors["source.scenarioId"]} />
          </div>
        ) : (
          <div className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Incident type</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PACK_SCENARIO_TYPES.map((type) => (
                  <label key={type} className={optionClass}>
                    <input
                      type="radio"
                      name="scenarioType"
                      value={type}
                      defaultChecked={values.scenarioType === type}
                      className="mt-0.5 size-4 accent-primary outline-none"
                    />
                    <span className="space-y-1">
                      <span className="block font-medium">{SCENARIO_TYPE_LABELS[type]}</span>
                      <span className="block text-muted-foreground">
                        {SCENARIO_TYPE_BRIEFS[type]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="focus">
                Anything to focus on?{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="focus"
                name="focus"
                rows={2}
                maxLength={FOCUS_MAX_LENGTH}
                defaultValue={values.focus}
                placeholder="e.g. Test the warehouse server and the bank call-back rule."
              />
              <FieldError id="focus-error" message={errors["source.focus"]} />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Participants</legend>
        <p className="text-sm text-muted-foreground">
          Each person gets their own link to follow along and sign off. Up to {MAX_PARTICIPANTS};
          you can add people later too. Email is optional and is only shown on the roster.
        </p>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor={`participantName-${index}`} className="sr-only">
                  Name
                </Label>
                <Input
                  id={`participantName-${index}`}
                  name="participantName"
                  defaultValue={row.name}
                  placeholder="Name"
                  aria-invalid={errors[`participants.${index}.name`] ? true : undefined}
                />
                <FieldError
                  id={`participantName-${index}-error`}
                  message={errors[`participants.${index}.name`]}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`participantEmail-${index}`} className="sr-only">
                  Email
                </Label>
                <Input
                  id={`participantEmail-${index}`}
                  name="participantEmail"
                  type="email"
                  defaultValue={row.email}
                  placeholder="Email (optional)"
                  aria-invalid={errors[`participants.${index}.email`] ? true : undefined}
                />
                <FieldError
                  id={`participantEmail-${index}-error`}
                  message={errors[`participants.${index}.email`]}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`participantRole-${index}`} className="sr-only">
                  Role
                </Label>
                <Input
                  id={`participantRole-${index}`}
                  name="participantRole"
                  defaultValue={row.role}
                  placeholder="Role, e.g. CEO"
                  aria-invalid={errors[`participants.${index}.role`] ? true : undefined}
                />
                <FieldError
                  id={`participantRole-${index}-error`}
                  message={errors[`participants.${index}.role`]}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove participant ${index + 1}`}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                disabled={rows.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((current) => [...current, EMPTY_ROW])}
          disabled={rows.length >= MAX_PARTICIPANTS}
        >
          Add participant
        </Button>
        <FieldError id="participants-error" message={errors.participants} />
      </fieldset>

      {state.status === "rate_limited" && (
        <Alert>
          <AlertTitle>Generation limit reached</AlertTitle>
          <AlertDescription>
            Up to 10 generated scenarios an hour per organization. Use a pack, or try later.
          </AlertDescription>
        </Alert>
      )}
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>The exercise could not be created</AlertTitle>
          <AlertDescription>{state.message ?? "Please try again in a moment."}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? sourceKind === "generate"
              ? "Writing the scenario..."
              : "Creating..."
            : "Create exercise"}
        </Button>
        {pending && sourceKind === "generate" && (
          <p role="status" className="text-sm text-muted-foreground">
            This can take up to a minute.
          </p>
        )}
      </div>
    </form>
  );
}
