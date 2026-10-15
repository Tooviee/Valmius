import { Badge } from "@/components/ui/badge";
import { EXERCISE_STATUS_LABELS, type ExerciseStatus } from "@/lib/schemas/exercise";

const VARIANTS: Record<ExerciseStatus, "outline" | "default" | "secondary"> = {
  scheduled: "outline",
  live: "default",
  ended: "secondary",
  reported: "secondary",
};

export function ExerciseStatusBadge({ status }: { status: ExerciseStatus }) {
  return (
    <Badge variant={VARIANTS[status]} data-testid="exercise-status">
      {EXERCISE_STATUS_LABELS[status]}
    </Badge>
  );
}
