"use client";

import { useEffect, useState } from "react";
import { elapsedMs, formatElapsed, nextInjectDueIn } from "@/lib/exercise/timer";

export function ExerciseTimer({
  startedAt,
  endedAt,
  injects,
  revealedCount,
}: {
  startedAt: string;
  endedAt: string | null;
  injects: { offset_minutes: number }[];
  revealedCount: number;
}) {
  const [tick, setTick] = useState(() => new Date());

  useEffect(() => {
    if (endedAt) return;
    const timer = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, [endedAt]);

  const now = endedAt ? new Date(endedAt) : tick;
  const elapsed = elapsedMs(startedAt, now);
  const dueIn = endedAt ? null : nextInjectDueIn(injects, revealedCount, elapsed);

  return (
    <div className="space-y-1" data-testid="timer">
      <p className="font-mono text-4xl font-semibold tabular-nums" aria-live="off">
        {formatElapsed(elapsed)}
      </p>
      <p className="text-sm text-muted-foreground">
        {endedAt
          ? "Final duration"
          : dueIn === null
            ? "All injects revealed"
            : dueIn === 0
              ? "Next inject is due"
              : `Next inject due in ${formatElapsed(dueIn)}`}
      </p>
      {/* Announced only at the moments that matter, never the ticking clock. */}
      <p role="status" className="sr-only">
        {endedAt
          ? ""
          : dueIn === null
            ? "All injects have been revealed."
            : dueIn === 0
              ? "The next inject is due."
              : ""}
      </p>
    </div>
  );
}
