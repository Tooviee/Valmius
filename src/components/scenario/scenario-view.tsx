import { Badge } from "@/components/ui/badge";
import { SCENARIO_TYPE_LABELS, type Scenario } from "@/lib/schemas/scenario";

function formatOffset(minutes: number): string {
  return minutes === 0 ? "Start" : `+${minutes} min`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold tracking-tight">{children}</h3>;
}

/** Renders a scenario for reading on screen. Facilitator notes are left for the PDF. */
export function ScenarioView({ scenario }: { scenario: Scenario }) {
  return (
    <article className="space-y-10" data-testid="scenario">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="secondary">{SCENARIO_TYPE_LABELS[scenario.type]}</Badge>
          <span className="text-sm text-muted-foreground">
            About {scenario.estimated_duration_minutes} minutes, {scenario.injects.length} injects
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-balance">{scenario.title}</h2>
        <p className="leading-relaxed text-muted-foreground">{scenario.summary}</p>
      </header>

      <section className="space-y-3">
        <SectionHeading>Setting</SectionHeading>
        <dl className="grid gap-4 rounded-xl border p-5 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-medium">Company</dt>
          <dd className="text-muted-foreground">{scenario.setting.company_profile}</dd>
          <dt className="font-medium">When</dt>
          <dd className="text-muted-foreground">{scenario.setting.day_and_time}</dd>
          <dt className="font-medium">First sign</dt>
          <dd className="text-muted-foreground">{scenario.setting.initial_signal}</dd>
        </dl>
      </section>

      <section className="space-y-3">
        <SectionHeading>Roles</SectionHeading>
        <ul className="grid gap-3 sm:grid-cols-2">
          {scenario.roles.map((role) => (
            <li key={role.name} className="rounded-xl border p-4 text-sm">
              <p className="font-medium">{role.name}</p>
              <p className="mt-1 text-muted-foreground">{role.responsibilities}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeading>Objectives</SectionHeading>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {scenario.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-5">
        <SectionHeading>Timeline</SectionHeading>
        <ol className="space-y-8 border-l pl-6">
          {scenario.injects.map((inject, position) => (
            <li key={`${position}-${inject.title}`} className="relative" data-testid="inject">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[1.9rem] size-3 rounded-full bg-primary ring-4 ring-background"
              />
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Inject {position + 1} ({formatOffset(inject.offset_minutes)})
              </p>
              <h4 className="mt-1 font-medium">{inject.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {inject.narrative}
              </p>
              <p className="mt-3 text-sm font-medium">Discuss</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {inject.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <SectionHeading>Wrap-up questions</SectionHeading>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {scenario.wrap_up_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
