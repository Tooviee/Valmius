"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createOrganizationAction } from "@/server/actions/organization";
import type { OrganizationFormValues, OrganizationState } from "@/server/actions/types";
import { OrganizationFields } from "./organization-fields";

const EMPTY_VALUES: OrganizationFormValues = {
  name: "",
  industry: "",
  headcountBand: "",
  frameworks: [],
  timezone: "",
};

const initialState: OrganizationState = { status: "idle" };

export function OnboardingForm({ timeZones }: { timeZones: string[] }) {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);
  const values = state.status === "idle" ? EMPTY_VALUES : state.values;
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="space-y-8">
      <OrganizationFields values={values} errors={errors} timeZones={timeZones} />

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
