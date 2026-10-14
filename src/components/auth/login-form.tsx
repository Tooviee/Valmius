"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestLoginLinkAction } from "@/server/actions/auth";
import type { LoginState } from "@/server/actions/types";

const initialState: LoginState = { status: "idle" };

const MESSAGES: Partial<Record<LoginState["status"], string>> = {
  invalid: "Please enter a valid email address.",
  rate_limited: "Too many sign-in emails were requested recently. Please wait a few minutes.",
  error: "We could not send the email just now. Please try again.",
};

const LINK_ERRORS: Record<string, { title: string; body: string }> = {
  link: {
    title: "That link no longer works",
    body: "Sign-in links work once and expire after an hour. Request a new one below.",
  },
  device: {
    title: "Open the link where you requested it",
    body: "This sign-in link only works in the browser that asked for it. Request a new link here, then open it in this same browser.",
  },
};

export function LoginForm({ linkError }: { linkError: string | null }) {
  const linkMessage = linkError ? LINK_ERRORS[linkError] : undefined;
  const [state, formAction, pending] = useActionState(requestLoginLinkAction, initialState);

  if (state.status === "sent") {
    return (
      <Alert data-testid="login-sent">
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          We sent you a sign-in link. It works once and expires in an hour. If it does not arrive
          within a couple of minutes, check your spam folder and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {linkMessage && (
        <Alert variant="destructive">
          <AlertTitle>{linkMessage.title}</AlertTitle>
          <AlertDescription>{linkMessage.body}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@company.com"
          aria-invalid={state.status === "invalid" ? true : undefined}
          aria-describedby={MESSAGES[state.status] ? "email-error" : undefined}
        />
        {MESSAGES[state.status] && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {MESSAGES[state.status]}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Email me a sign-in link"}
      </Button>
      <p className="text-xs text-muted-foreground">
        No password to remember. First time here? The same link creates your account.
      </p>
    </form>
  );
}
