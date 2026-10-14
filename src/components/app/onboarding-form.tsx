"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { HEADCOUNT_BANDS, INDUSTRIES, INDUSTRY_LABELS } from "@/lib/schemas/generator";
import { FRAMEWORK_LABELS, FRAMEWORKS, ORG_NAME_MAX_LENGTH } from "@/lib/schemas/organization";
import { createOrganizationAction } from "@/server/actions/organization";
import type { OrganizationFormValues, OrganizationState } from "@/server/actions/types";

const EMPTY_VALUES: OrganizationFormValues = {
  name: "",
  industry: "",
  headcountBand: "",
  frameworks: [],
  timezone: "",
};

const initialState: OrganizationState = { status: "idle" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function OnboardingForm({ timeZones }: { timeZones: string[] }) {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);
  const timezoneRef = useRef<HTMLSelectElement>(null);

  const values = state.status === "idle" ? EMPTY_VALUES : state.values;
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  // Preselect the browser's zone. Done after mount so the server-rendered markup, which
  // cannot know the zone, still matches what the browser first draws.
  useEffect(() => {
    const select = timezoneRef.current;
    if (!select || select.value) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZones.includes(zone)) select.value = zone;
  }, [timeZones]);

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="name">Company name</Label>
        <Input
          key={values.name}
          id="name"
          name="name"
          required
          maxLength={ORG_NAME_MAX_LENGTH}
          defaultValue={values.name}
          autoComplete="organization"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : "name-hint"}
        />
        <p id="name-hint" className="text-sm text-muted-foreground">
          Appears on the plan and on every report.
        </p>
        <FieldError id="name-error" message={errors.name} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <NativeSelect
            key={values.industry}
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
            key={values.headcountBand}
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
        aria-describedby={errors.frameworks ? "frameworks-error" : "frameworks-hint"}
      >
        <legend className="text-sm font-medium">Compliance obligations</legend>
        <p id="frameworks-hint" className="text-sm text-muted-foreground">
          Choose all that apply. You can change these later in the questionnaire.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FRAMEWORKS.map((framework) => (
            <label
              key={framework}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="checkbox"
                name="frameworks"
                value={framework}
                defaultChecked={values.frameworks.includes(framework)}
                className="size-4 accent-primary outline-none"
              />
              {FRAMEWORK_LABELS[framework]}
            </label>
          ))}
        </div>
        <FieldError id="frameworks-error" message={errors.frameworks} />
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="timezone">Time zone</Label>
        <NativeSelect
          key={values.timezone}
          ref={timezoneRef}
          id="timezone"
          name="timezone"
          required
          defaultValue={values.timezone}
          aria-invalid={errors.timezone ? true : undefined}
          aria-describedby={errors.timezone ? "timezone-error" : "timezone-hint"}
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            Select a time zone
          </NativeSelectOption>
          {timeZones.map((zone) => (
            <NativeSelectOption key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p id="timezone-hint" className="text-sm text-muted-foreground">
          Exercise times and report dates are shown in this zone.
        </p>
        <FieldError id="timezone-error" message={errors.timezone} />
      </div>

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>We could not create your organization</AlertTitle>
          <AlertDescription>Please try again in a moment.</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating..." : "Create organization"}
      </Button>
    </form>
  );
}
