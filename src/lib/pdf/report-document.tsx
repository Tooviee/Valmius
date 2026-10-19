import { Document, Page, Text, View } from "@react-pdf/renderer";
import { markdownToBlocks } from "@/lib/markdown/blocks";
import { REPORT_NARRATIVE_SECTIONS, type ReportContent } from "@/lib/schemas/report";
import { Blocks, pdfStyles as s } from "./plan-document";
import { toPdfText } from "./text";
import { PdfMark } from "./brand";

export type ReportPdfInput = {
  content: ReportContent;
  reportId: string;
  version: number;
  generatedAt: Date;
  /** SHA-256 of the report content; the file's own hash lives in the vault. */
  fingerprint: string;
  siteUrl: string;
};

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

type Column = { header: string; flex: number };

function Table({ columns, rows }: { columns: Column[]; rows: string[][] }) {
  return (
    <View style={s.table}>
      <View style={s.row} wrap={false}>
        {columns.map((column, i) => (
          <Text
            key={column.header}
            style={[s.cell, s.headerCell, i === 0 ? s.firstCell : {}, { flex: column.flex }]}
          >
            {column.header}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={s.row} wrap={false}>
          <Text style={[s.cell, s.firstCell, { flex: 1 }]}>None recorded</Text>
        </View>
      ) : (
        rows.map((cells, r) => (
          <View key={r} style={s.row} wrap={false}>
            {columns.map((column, i) => (
              <Text
                key={column.header}
                style={[s.cell, i === 0 ? s.firstCell : {}, { flex: column.flex }]}
              >
                {toPdfText(cells[i] ?? "")}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function Footer({ content, version }: { content: ReportContent; version: number }) {
  return (
    <>
      <Text style={s.footerLeft} fixed>
        {toPdfText(
          `${content.cover.org_name} | After-action report v${version} | ${content.cover.exercise_title} | ${fmtDateTime(content.cover.ended_at, content.cover.timezone)}`,
        )}
      </Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </>
  );
}

/** The after-action report PDF, section 8.4 of SPEC.md in order. */
export function ReportDocument({ input }: { input: ReportPdfInput }) {
  const { content, version } = input;
  const { cover } = content;
  const tz = cover.timezone;
  const attended = content.participants.filter((p) => p.attended_at).length;

  return (
    <Document
      title={toPdfText(`${cover.org_name}: After-action report, ${cover.exercise_title}`)}
      author="Valmius"
      subject="Tabletop exercise after-action report"
    >
      <Page size="LETTER" style={s.page}>
        <View style={s.brandRow} fixed>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <PdfMark />
            <Text style={s.brand}>Valmius</Text>
          </View>
          <Text style={s.brandNote}>{toPdfText(`After-action report, version ${version}`)}</Text>
        </View>
        <Footer content={content} version={version} />

        <Text style={s.title}>{toPdfText(`After-action report: ${cover.exercise_title}`)}</Text>
        <Text style={s.subtitle}>{toPdfText(cover.org_name)}</Text>
        <Text style={s.meta}>
          {toPdfText(
            `Scenario: ${cover.scenario_title} (${cover.scenario_type}${cover.scenario_from_plan ? ", generated from the company's plan" : ", standard pack"})`,
          )}
        </Text>
        <Text style={s.meta}>
          {toPdfText(
            `Held ${fmtDateTime(cover.started_at, tz)} to ${fmtDateTime(cover.ended_at, tz)}${cover.duration_minutes !== null ? `, ${cover.duration_minutes} minutes` : ""}`,
          )}
        </Text>
        <Text style={s.meta}>
          {toPdfText(
            `Facilitator: ${cover.facilitator}. Plan version tested: ${cover.plan_version ? `${cover.plan_version} (${cover.plan_status})` : "none attached"}. Obligations: ${cover.frameworks.join(", ") || "none listed"}.`,
          )}
        </Text>
        <Text style={s.meta}>
          {toPdfText(
            `${attended} of ${content.participants.length} invited participants attended; ${content.participants.filter((p) => p.signed_off_at).length} signed off.`,
          )}
        </Text>

        <Text style={s.h2}>1. Participants</Text>
        <Table
          columns={[
            { header: "Name", flex: 3 },
            { header: "Role", flex: 3 },
            { header: "Attended", flex: 3 },
            { header: "Signed off", flex: 4 },
          ]}
          rows={content.participants.map((p) => [
            p.name,
            p.role,
            p.attended_at ? fmtTime(p.attended_at, tz) : "No",
            p.signed_off_at
              ? `${p.signature_name ?? ""}, ${fmtTime(p.signed_off_at, tz)}`
              : "Not signed",
          ])}
        />

        <Text style={s.h2}>2. Scenario and injects used</Text>
        <Text style={s.paragraph}>{toPdfText(content.scenario_summary)}</Text>
        <Table
          columns={[
            { header: "#", flex: 1 },
            { header: "Inject", flex: 8 },
            { header: "Planned", flex: 2 },
            { header: "Shown", flex: 2 },
          ]}
          rows={content.injects_used.map((i) => [
            String(i.index + 1),
            i.title,
            i.offset_minutes === 0 ? "Start" : `+${i.offset_minutes} min`,
            i.revealed_at ? fmtTime(i.revealed_at, tz) : "",
          ])}
        />

        <Text style={s.h2} minPresenceAhead={60}>
          3. Decision timeline
        </Text>
        <Table
          columns={[
            { header: "Time", flex: 2 },
            { header: "Inject", flex: 2 },
            { header: "Who", flex: 3 },
            { header: "Decision", flex: 9 },
          ]}
          rows={content.timeline.map((t) => [
            fmtTime(t.logged_at, tz),
            t.inject_index === null ? "General" : `Inject ${t.inject_index + 1}`,
            t.actor_name,
            t.notes ? `${t.decision} (${t.notes})` : t.decision,
          ])}
        />

        {REPORT_NARRATIVE_SECTIONS.map((section, index) => (
          <View key={section.id}>
            <Text style={s.h2} minPresenceAhead={60}>
              {toPdfText(`${index + 4}. ${section.title}`)}
            </Text>
            <Blocks blocks={markdownToBlocks(content.narrative[section.id])} />
          </View>
        ))}

        <Text style={s.h2} minPresenceAhead={60}>
          9. Findings
        </Text>
        <Text style={s.h3}>Strengths observed</Text>
        <Table
          columns={[{ header: "Strength", flex: 1 }]}
          rows={content.strengths.map((f) => [f.description])}
        />
        <Text style={s.h3}>Gaps</Text>
        <Table
          columns={[
            { header: "Gap", flex: 8 },
            { header: "Severity", flex: 2 },
          ]}
          rows={content.gaps.map((g) => [g.description, g.severity ?? "unrated"])}
        />
        <Text style={s.h3}>Action items</Text>
        <Table
          columns={[
            { header: "Action", flex: 7 },
            { header: "Owner", flex: 3 },
            { header: "Due", flex: 2 },
          ]}
          rows={content.action_items.map((a) => [
            a.description,
            a.owner_name ?? "",
            a.due_date ?? "",
          ])}
        />
        {content.parking_lot && (
          <>
            <Text style={s.h3}>Parking lot</Text>
            <Text style={s.paragraph}>{toPdfText(content.parking_lot)}</Text>
          </>
        )}

        <Text style={s.h2} minPresenceAhead={60}>
          10. Control mapping
        </Text>
        <Text style={s.paragraph}>
          The controls this exercise gives evidence toward, from the injects that were used. It does
          not, on its own, make the company compliant with any framework.
        </Text>
        <Table
          columns={[
            { header: "Control", flex: 3 },
            { header: "What it asks for", flex: 8 },
          ]}
          rows={content.control_mapping.map((c) => [c.ref, c.summary])}
        />

        <Text style={s.h2} minPresenceAhead={120}>
          11. Attestation
        </Text>
        <View style={s.quote} wrap={false}>
          <Text style={s.paragraph}>
            {toPdfText(
              `This report was generated by Valmius on ${fmtDateTime(input.generatedAt.toISOString(), tz)} (${tz}) from the exercise record, including server-timestamped decisions and participant sign-offs.`,
            )}
          </Text>
          <Text style={s.paragraph}>
            {toPdfText(`Report id: ${input.reportId}, version ${version}.`)}
          </Text>
          <Text style={s.paragraph}>
            {toPdfText(`Content fingerprint (SHA-256 of the report data): ${input.fingerprint}`)}
          </Text>
          <Text style={s.paragraph}>
            {toPdfText(
              `The SHA-256 of this PDF file is recorded in the Valmius evidence vault (${input.siteUrl}) and shown beside the download. A file whose hash matches that record is unaltered.`,
            )}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
