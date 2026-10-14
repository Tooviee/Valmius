import Link from "next/link";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { QUESTIONNAIRE_STEPS, type QuestionnaireStep } from "@/lib/schemas/questionnaire";

export function QuestionnaireProgress({
  current,
  complete,
}: {
  current: QuestionnaireStep;
  complete: Record<QuestionnaireStep, boolean>;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Questionnaire steps">
      {QUESTIONNAIRE_STEPS.map((step) => {
        const isCurrent = step.step === current;
        const isDone = complete[step.step];
        return (
          <li key={step.step}>
            <Link
              href={`/app/questionnaire?step=${step.step}`}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex h-full flex-col gap-1 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted",
                isCurrent && "border-primary bg-muted",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border text-xs",
                    isDone && "border-primary bg-primary text-primary-foreground",
                  )}
                  aria-hidden
                >
                  {isDone ? <CheckIcon className="size-3" /> : step.step}
                </span>
                {step.title}
              </span>
              <span className="text-xs text-muted-foreground">{step.questions}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
