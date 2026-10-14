"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approvePlanAction } from "@/server/actions/plan";
import type { ApprovePlanState } from "@/server/actions/types";

const initialState: ApprovePlanState = { status: "idle" };

const MESSAGES: Partial<Record<ApprovePlanState["status"], { title: string; body: string }>> = {
  invalid: {
    title: "Enter the approver's name",
    body: "The name is printed on every exported page.",
  },
  needs_review: {
    title: "Template sections need attention first",
    body: "One or more sections were filled from a template. Regenerate or edit them, save, and then approve.",
  },
  already_approved: {
    title: "Already approved",
    body: "This version was approved by someone else just now.",
  },
  error: { title: "The plan could not be approved", body: "Please try again in a moment." },
};

export function ApprovePlanForm({
  planId,
  version,
  approverHint,
  hasUnsavedChanges,
}: {
  planId: string;
  version: number;
  approverHint: string;
  hasUnsavedChanges?: boolean;
}) {
  const [state, formAction, pending] = useActionState(approvePlanAction, initialState);
  const message = MESSAGES[state.status];

  return (
    <Card data-testid="approve-plan">
      <CardHeader>
        <CardTitle>Approve version {version}</CardTitle>
        <CardDescription>
          Approving records who signed off and when, and freezes this version so the copy an auditor
          sees is the copy that was approved. Later edits create a new version. The questionnaire
          names {approverHint} as the approver.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="planId" value={planId} />
          <div className="flex-1 space-y-2">
            <Label htmlFor="approvedByName">Approved by (full name and role)</Label>
            <Input
              id="approvedByName"
              name="approvedByName"
              required
              maxLength={120}
              placeholder="e.g. Jordan Park, CEO"
              autoComplete="name"
            />
          </div>
          <Button type="submit" size="lg" disabled={pending || hasUnsavedChanges}>
            {pending ? "Approving..." : "Approve this version"}
          </Button>
        </form>
        {hasUnsavedChanges && (
          <p className="mt-2 text-sm text-muted-foreground">Save your changes before approving.</p>
        )}
        {message && !pending && (
          <Alert
            variant={state.status === "needs_review" ? "destructive" : "default"}
            className="mt-4"
          >
            <AlertTitle>{message.title}</AlertTitle>
            <AlertDescription>{message.body}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
