import Link from "next/link";
import { cn } from "cn";
import type { PlanSummary } from "@/lib/plan/load";

export function VersionNav({ versions, current }: { versions: PlanSummary[]; current: number }) {
  if (versions.length <= 1) return null;
  return (
    <nav aria-label="Plan versions" className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="mr-1 text-muted-foreground">Versions:</span>
      {versions.map((plan) => (
        <Link
          key={plan.id}
          href={`/app/plan?v=${plan.version}`}
          aria-current={plan.version === current ? "page" : undefined}
          className={cn(
            "rounded-md border px-2 py-0.5 transition-colors hover:bg-muted",
            plan.version === current && "border-primary bg-muted font-medium",
          )}
        >
          v{plan.version}
          {plan.status === "approved" ? " ✓" : ""}
        </Link>
      ))}
    </nav>
  );
}
