"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { generateReportAction } from "@/server/actions/report";
import type { GenerateReportState } from "@/server/actions/types";

const initialState: GenerateReportState = { status: "idle" };

const MESSAGES: Partial<Record<GenerateReportState["status"], { title: string; body: string }>> = {
  rate_limited: {
    title: "Generation limit reached",
    body: "Up to 10 report generations an hour per organization. Edit the current draft, or try again later.",
  },
  error: { title: "The report could not be generated", body: "Please try again in a moment." },
  not_ended: {
    title: "End the exercise first",
    body: "A report is written from the final decision log, so the exercise has to be over.",
  },
};

export function GenerateReportForm({
  exerciseId,
  label,
  variant = "default",
}: {
  exerciseId: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(generateReportAction, initialState);
  const message = MESSAGES[state.status];
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="exerciseId" value={exerciseId} />
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="lg"
          variant={variant}
          disabled={pending}
          data-testid="generate-report"
        >
          {pending ? "Writing the report..." : label}
        </Button>
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            About half a minute.
          </p>
        )}
      </div>
      {message && !pending && (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.body}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
