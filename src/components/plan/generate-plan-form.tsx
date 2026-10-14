"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { generatePlanAction } from "@/server/actions/plan";
import type { GeneratePlanState } from "@/server/actions/types";

const initialState: GeneratePlanState = { status: "idle" };

export function GeneratePlanForm({
  label = "Generate plan",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(generatePlanAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" variant={variant} disabled={pending}>
          {pending ? "Writing your plan..." : label}
        </Button>
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            Eleven sections are written in parallel. This takes about a minute.
          </p>
        )}
      </div>
      {!pending && state.status === "rate_limited" && (
        <Alert>
          <AlertTitle>Generation limit reached</AlertTitle>
          <AlertDescription>
            Up to 10 plan generations an hour per organization. Edit the current version, or try
            again later.
          </AlertDescription>
        </Alert>
      )}
      {!pending && state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>The plan could not be generated</AlertTitle>
          <AlertDescription>Please try again in a moment.</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
