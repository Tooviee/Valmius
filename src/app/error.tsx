"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shown when a page throws. The message stays generic; details go to the server log. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-medium tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        The page could not be shown. Nothing you entered was lost unless this page says so; try
        again, and if it keeps happening, tell us
        {error.digest ? ` and quote the code ${error.digest}` : ""}.
      </p>
      <div className="mt-6">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </main>
  );
}
