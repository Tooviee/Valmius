"use client";

import { useEffect, useRef } from "react";
import {
  CheckboxGroup,
  SelectField,
  TextField,
  toOptions,
} from "@/components/questionnaire/fields";
import { HEADCOUNT_BANDS, INDUSTRIES, INDUSTRY_LABELS } from "@/lib/schemas/generator";
import { FRAMEWORK_LABELS, FRAMEWORKS, ORG_NAME_MAX_LENGTH } from "@/lib/schemas/organization";

export type OrganizationFieldValues = {
  name: string;
  industry: string;
  headcountBand: string;
  frameworks: readonly string[];
  timezone: string;
};

/**
 * The organization's own fields: used by onboarding and again by questionnaire step 1
 * (questions 1 and 2), so both edit the same organization row.
 */
export function OrganizationFields({
  values,
  errors,
  timeZones,
}: {
  values: OrganizationFieldValues;
  errors: Record<string, string | undefined>;
  timeZones: string[];
}) {
  const timezoneRef = useRef<HTMLSelectElement>(null);

  // Preselect the browser's zone when none is set yet. Done after mount so the
  // server-rendered markup, which cannot know the zone, matches what the browser draws.
  useEffect(() => {
    const select = timezoneRef.current;
    if (!select || select.value) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZones.includes(zone)) select.value = zone;
  }, [timeZones]);

  return (
    <>
      <TextField
        name="name"
        label="Company name"
        required
        maxLength={ORG_NAME_MAX_LENGTH}
        defaultValue={values.name}
        autoComplete="organization"
        hint="Appears on the plan and on every report."
        error={errors.name}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          name="industry"
          label="Industry"
          placeholder="Select an industry"
          options={toOptions(INDUSTRIES, INDUSTRY_LABELS)}
          defaultValue={values.industry}
          error={errors.industry}
        />
        <SelectField
          name="headcountBand"
          label="Company size"
          placeholder="Select a size"
          options={HEADCOUNT_BANDS.map((band) => ({ value: band, label: `${band} employees` }))}
          defaultValue={values.headcountBand}
          error={errors.headcountBand}
        />
      </div>
      <CheckboxGroup
        name="frameworks"
        label="Compliance obligations"
        hint="Choose all that apply: the frameworks, regulators and insurers that ask you for an incident response plan."
        options={toOptions(FRAMEWORKS, FRAMEWORK_LABELS)}
        defaultValue={values.frameworks}
        error={errors.frameworks}
      />
      <SelectField
        name="timezone"
        label="Time zone"
        placeholder="Select a time zone"
        options={timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
        defaultValue={values.timezone}
        selectRef={timezoneRef}
        hint="Exercise times and report dates are shown in this zone."
        error={errors.timezone}
      />
    </>
  );
}
