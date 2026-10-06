"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitLeadAction } from "@/server/actions/submit-lead";
import type { LeadState } from "@/server/actions/types";

const initialState: LeadState = { status: "idle" };

const MESSAGES: Partial<Record<LeadState["status"], string>> = {
  invalid: "Please enter a valid email address.",
  rate_limited: "Too many attempts from this address. Please try again later.",
  error: "We could not save that just now. Please try again.",
};

/** The landing page's "notify me when the full product launches" capture. */
export function NotifyForm() {
  const [state, formAction, pending] = useActionState(submitLeadAction, initialState);

  if (state.status === "ok") {
    return (
      <p role="status" className="font-medium">
        Thanks. We will email you when Drill Day launches.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="source" value="landing" />
        <div className="flex-1">
          <Label htmlFor="notify-email" className="sr-only">
            Work email
          </Label>
          <Input
            id="notify-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className="bg-background"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "One moment..." : "Notify me"}
        </Button>
      </form>
      {MESSAGES[state.status] && (
        <p role="alert" className="text-sm text-destructive">
          {MESSAGES[state.status]}
        </p>
      )}
    </div>
  );
}
