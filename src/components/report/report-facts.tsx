import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportContent } from "@/lib/schemas/report";

const fmtDateTime = (iso: string | null, timeZone: string) =>
  iso
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(iso))
    : "not recorded";
const fmtTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone }).format(new Date(iso));

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-muted-foreground">{number}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The factual sections of the report, as the PDF will print them. Read-only by design. */
export function ReportFacts({ content, part }: { content: ReportContent; part: "head" | "tail" }) {
  const { cover } = content;
  const tz = cover.timezone;

  if (part === "head") {
    return (
      <>
        <section className="space-y-2 rounded-xl border bg-muted/40 p-5" data-testid="report-cover">
          <p className="text-sm text-muted-foreground">
            {cover.scenario_type}: {cover.scenario_title}
            {cover.scenario_from_plan ? " (generated from your plan)" : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Held {fmtDateTime(cover.started_at, tz)} to {fmtDateTime(cover.ended_at, tz)}
            {cover.duration_minutes !== null ? `, ${cover.duration_minutes} minutes` : ""}.
            Facilitator {cover.facilitator}. Plan version tested:{" "}
            {cover.plan_version ? `${cover.plan_version} (${cover.plan_status})` : "none attached"}.
          </p>
        </section>
        <Section number={1} title="Participants">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Attended</TableHead>
                <TableHead>Signed off</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.participants.map((p) => (
                <TableRow key={`${p.name}-${p.role}`}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.role}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.attended_at ? fmtTime(p.attended_at, tz) : "No"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.signed_off_at
                      ? `${p.signature_name}, ${fmtTime(p.signed_off_at, tz)}`
                      : "Not signed"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section number={2} title="Scenario and injects used">
          <p className="text-sm text-muted-foreground">{content.scenario_summary}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {content.injects_used.map((i) => (
              <li key={i.index}>
                {i.title}{" "}
                <span className="text-muted-foreground">
                  ({i.offset_minutes === 0 ? "start" : `+${i.offset_minutes} min`}
                  {i.revealed_at ? `, shown ${fmtTime(i.revealed_at, tz)}` : ""})
                </span>
              </li>
            ))}
          </ol>
        </Section>
        <Section number={3} title="Decision timeline">
          {content.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions were logged.</p>
          ) : (
            <Table data-testid="report-timeline">
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Inject</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.timeline.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{fmtTime(t.logged_at, tz)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.inject_index === null ? "General" : `Inject ${t.inject_index + 1}`}
                    </TableCell>
                    <TableCell>{t.actor_name}</TableCell>
                    <TableCell>
                      {t.decision}
                      {t.notes && <span className="block text-muted-foreground">{t.notes}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </>
    );
  }

  return (
    <>
      <Section number={9} title="Findings">
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <p className="font-medium">Strengths</p>
            <ul className="mt-1 list-disc pl-5">
              {content.strengths.length ? (
                content.strengths.map((f, i) => <li key={i}>{f.description}</li>)
              ) : (
                <li className="text-muted-foreground">None recorded</li>
              )}
            </ul>
          </div>
          <div>
            <p className="font-medium">Gaps</p>
            <ul className="mt-1 list-disc pl-5">
              {content.gaps.length ? (
                content.gaps.map((g, i) => (
                  <li key={i}>
                    {g.severity && (
                      <Badge variant="outline" className="mr-1">
                        {g.severity}
                      </Badge>
                    )}
                    {g.description}
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">None recorded</li>
              )}
            </ul>
          </div>
          <div>
            <p className="font-medium">Action items</p>
            <ul className="mt-1 list-disc pl-5">
              {content.action_items.length ? (
                content.action_items.map((a, i) => (
                  <li key={i}>
                    {a.description}
                    {(a.owner_name || a.due_date) && (
                      <span className="block text-muted-foreground">
                        {[a.owner_name, a.due_date ? `due ${a.due_date}` : null]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">None recorded</li>
              )}
            </ul>
          </div>
        </div>
        {content.parking_lot && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Parking lot:</span> {content.parking_lot}
          </p>
        )}
      </Section>
      <Section number={10} title="Control mapping">
        <div className="flex flex-wrap gap-1.5">
          {content.control_mapping.length ? (
            content.control_mapping.map((c) => (
              <Badge key={c.ref} variant="outline" title={c.summary}>
                {c.ref}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No injects were revealed, so no controls are evidenced.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
