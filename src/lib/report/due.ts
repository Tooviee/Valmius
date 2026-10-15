/** "Next test due" rules (SPEC.md section 7, Phase 4): 12 months after the last ended exercise. */

export const TEST_INTERVAL_MONTHS = 12;

export function nextTestDue(lastEndedAt: string | Date | null): Date | null {
  if (!lastEndedAt) return null;
  const due = new Date(lastEndedAt);
  due.setUTCMonth(due.getUTCMonth() + TEST_INTERVAL_MONTHS);
  return due;
}

export type DueState = "never_tested" | "ok" | "due_soon" | "overdue";

/** "due_soon" inside 60 days of the due date, "overdue" past it. */
export function dueState(lastEndedAt: string | Date | null, now: Date = new Date()): DueState {
  const due = nextTestDue(lastEndedAt);
  if (!due) return "never_tested";
  const daysLeft = (due.getTime() - now.getTime()) / 86_400_000;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 60) return "due_soon";
  return "ok";
}
