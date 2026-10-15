"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies a participant's link; the MVP sends no email, so the facilitator shares it. */
export function CopyLinkButton({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
