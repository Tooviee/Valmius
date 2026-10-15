/** Timer and inject timing for the facilitator console (SPEC.md section 7, Phase 3). */

export type InjectState = "revealed" | "due" | "upcoming";

/** Milliseconds since the exercise started, never negative. */
export function elapsedMs(startedAt: string | Date, now: Date = new Date()): number {
  const started = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  return Math.max(0, now.getTime() - started.getTime());
}

/** "mm:ss" under an hour, "h:mm:ss" from then on. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "+15 min" style label for an inject's planned offset; the first inject is "Start". */
export function formatOffset(offsetMinutes: number): string {
  return offsetMinutes === 0 ? "Start" : `+${offsetMinutes} min`;
}

/**
 * The state of each inject: already revealed, due (its planned offset has passed but the
 * facilitator has not revealed it yet), or upcoming.
 */
export function injectStates(
  injects: ReadonlyArray<{ offset_minutes: number }>,
  revealedCount: number,
  elapsed: number,
): InjectState[] {
  const elapsedMinutes = elapsed / 60_000;
  return injects.map((inject, index) => {
    if (index < revealedCount) return "revealed";
    return inject.offset_minutes <= elapsedMinutes ? "due" : "upcoming";
  });
}

/**
 * Milliseconds until the next unrevealed inject is due by the scenario's timings, 0 when it
 * is already due, or null when every inject has been revealed.
 */
export function nextInjectDueIn(
  injects: ReadonlyArray<{ offset_minutes: number }>,
  revealedCount: number,
  elapsed: number,
): number | null {
  const next = injects[revealedCount];
  if (!next) return null;
  return Math.max(0, next.offset_minutes * 60_000 - elapsed);
}
