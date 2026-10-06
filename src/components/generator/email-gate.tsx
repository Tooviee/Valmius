"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario } from "@/lib/schemas/scenario";
import { submitLeadAction } from "@/server/actions/submit-lead";
import type { GeneratorFormValues, LeadState } from "@/server/actions/types";

const initialState: LeadState = { status: "idle" };

const MESSAGES: Partial<Record<LeadState["status"], string>> = {
  invalid: "Please enter a valid email address.",
  rate_limited: "Too many attempts from this address. Please try again later.",
  error: "We could not save that just now. Please try again.",
};

/**
 * The email gate in front of the PDF. On success the browser posts the scenario to
 * the download route, which answers with the PDF as an attachment.
 */
export function EmailGate({
  scenario,
  values,
}: {
  scenario: Scenario;
  values: GeneratorFormValues;
}) {
  const [state, formAction, pending] = useActionState(submitLeadAction, initialState);
  const downloadForm = useRef<HTMLFormElement>(null);
  const unlocked = state.status === "ok";

  useEffect(() => {
    if (state.status === "ok") downloadForm.current?.requestSubmit();
  }, [state]);

  return (
    <Card className="bg-muted/40" data-testid="email-gate">
      <CardHeader>
        <CardTitle className="text-base">
          Download the full scenario + after-action template (PDF)
        </CardTitle>
        <CardDescription>
          The PDF adds what the facilitator needs: the expected actions for each step, the controls
          each step gives evidence toward, and a blank after-action report to fill in on the day.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {unlocked ? (
          <p role="status" className="text-sm font-medium">
            Your download has started.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="source" value="generator" />
            <input type="hidden" name="industry" value={values.industry} />
            <input type="hidden" name="headcountBand" value={values.headcountBand} />
            <input type="hidden" name="scenarioType" value={values.scenarioType} />
            <div className="flex-1">
              <Label htmlFor="lead-email" className="sr-only">
                Work email
              </Label>
              <Input
                id="lead-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="bg-background"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "One moment..." : "Download PDF"}
            </Button>
          </form>
        )}

        {!unlocked && MESSAGES[state.status] && (
          <p role="alert" className="text-sm text-destructive">
            {MESSAGES[state.status]}
          </p>
        )}

        <form
          ref={downloadForm}
          method="post"
          action="/api/scenario-pdf"
          className={unlocked ? "" : "hidden"}
        >
          <input type="hidden" name="scenario" value={JSON.stringify(scenario)} />
          {unlocked && (
            <Button type="submit" variant="outline" size="sm">
              Download again
            </Button>
          )}
        </form>

        <p className="text-xs text-muted-foreground">
          We use your address to let you know when the full product launches. Nothing is emailed to
          you today.
        </p>
      </CardContent>
    </Card>
  );
}
