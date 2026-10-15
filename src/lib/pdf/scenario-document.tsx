import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FRAMEWORK_REFS, FRAMEWORK_REF_SUMMARIES } from "@/lib/schemas/frameworks";
import { SCENARIO_TYPE_LABELS, type Scenario } from "@/lib/schemas/scenario";
import { toPdfText } from "./text";

const colors = {
  text: "#171717",
  muted: "#525252",
  line: "#c4c4c4",
  fill: "#f4f4f5",
};

// Line height is set per text style, in points, rather than once on the page: a page-level
// lineHeight stops react-pdf from laying out the dynamic page-number text in the footer, and
// a unitless value on a Text is applied twice.
const lineHeight = (fontSize: number) => `${(fontSize * 1.45).toFixed(1)}pt`;

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 62,
    paddingHorizontal: 54,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.text,
  },

  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 6,
    marginBottom: 18,
  },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  brandNote: { fontSize: 9, color: colors.muted },
  title: { fontFamily: "Helvetica-Bold", fontSize: 19, lineHeight: 1.25, marginBottom: 4 },
  meta: { fontSize: 9.5, lineHeight: lineHeight(9.5), color: colors.muted, marginBottom: 10 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 16, marginBottom: 6 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginTop: 2, marginBottom: 4 },
  label: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2 },
  paragraph: { lineHeight: lineHeight(10), marginBottom: 6 },
  muted: { color: colors.muted },
  small: { fontSize: 8.5, lineHeight: lineHeight(8.5), color: colors.muted },
  box: {
    backgroundColor: colors.fill,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  listItem: { flexDirection: "row", marginBottom: 2.5 },
  listMarker: { width: 14 },
  listText: { flex: 1, lineHeight: lineHeight(10) },
  inject: { marginBottom: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.line },
  injectTag: { fontSize: 8.5, color: colors.muted, fontFamily: "Helvetica-Bold" },
  facilitator: { marginTop: 5, paddingTop: 5, borderTopWidth: 0.5, borderTopColor: colors.line },
  table: { marginBottom: 8 },
  row: { flexDirection: "row" },
  cell: {
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: colors.line,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 9,
    lineHeight: lineHeight(9),
  },
  firstCell: { borderLeftWidth: 0.75 },
  headerCell: { borderTopWidth: 0.75, backgroundColor: colors.fill, fontFamily: "Helvetica-Bold" },
  fieldRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 9 },
  fieldLabel: { width: 122, fontSize: 9.5 },
  fieldLine: {
    flex: 1,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.line,
    minHeight: 13,
    lineHeight: lineHeight(10),
  },
  writeLine: { borderBottomWidth: 0.75, borderBottomColor: colors.line, height: 20 },
  footerLeft: { position: "absolute", bottom: 28, left: 54, fontSize: 8, color: colors.muted },
  // A render-prop Text has no width of its own, so span the page and right-align.
  footerRight: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    fontSize: 8,
    color: colors.muted,
    textAlign: "right",
  },
});

type Column = { header: string; flex: number };

function Table({
  columns,
  rows,
  rowHeight,
}: {
  columns: Column[];
  rows: string[][];
  rowHeight?: number;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.row} wrap={false}>
        {columns.map((column, columnIndex) => (
          <Text
            key={column.header}
            style={[
              styles.cell,
              styles.headerCell,
              columnIndex === 0 ? styles.firstCell : {},
              { flex: column.flex },
            ]}
          >
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((cells, rowIndex) => (
        <View key={rowIndex} style={styles.row} wrap={false}>
          {columns.map((column, columnIndex) => (
            <Text
              key={column.header}
              style={[
                styles.cell,
                columnIndex === 0 ? styles.firstCell : {},
                { flex: column.flex, minHeight: rowHeight },
              ]}
            >
              {cells[columnIndex] ?? ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function BulletList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text style={styles.listMarker}>{ordered ? `${index + 1}.` : "-"}</Text>
          <Text style={styles.listText}>{toPdfText(item)}</Text>
        </View>
      ))}
    </View>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldLine}>{value ?? ""}</Text>
    </View>
  );
}

function WriteLines({ count }: { count: number }) {
  return (
    <View style={{ marginBottom: 8 }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.writeLine} />
      ))}
    </View>
  );
}

function BrandRow({ note }: { note: string }) {
  return (
    <View style={styles.brandRow} fixed>
      <Text style={styles.brand}>Valmius</Text>
      <Text style={styles.brandNote}>{note}</Text>
    </View>
  );
}

function Footer({ siteUrl, generatedOn }: { siteUrl: string; generatedOn: string }) {
  return (
    <>
      <Text style={styles.footerLeft} fixed>
        {`Valmius | ${siteUrl} | Generated ${generatedOn} (UTC)`}
      </Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </>
  );
}

const blankRows = (count: number, columns: number): string[][] =>
  Array.from({ length: count }, () => Array<string>(columns).fill(""));

export type ScenarioDocumentProps = {
  scenario: Scenario;
  /** Date shown in the footer, formatted as YYYY-MM-DD. */
  generatedOn: string;
  siteUrl: string;
};

/**
 * The PDF behind the email gate: the full scenario, including the facilitator notes
 * that are not shown on the page, followed by a blank after-action report template
 * that follows the outline in SPEC.md section 8.4.
 */
export function ScenarioDocument({ scenario, generatedOn, siteUrl }: ScenarioDocumentProps) {
  const usedRefs = new Set(scenario.injects.flatMap((inject) => inject.framework_refs));
  const controls = FRAMEWORK_REFS.filter((ref) => usedRefs.has(ref));
  const title = toPdfText(scenario.title);

  return (
    <Document title={`${title} - Valmius`} author="Valmius" subject="Tabletop exercise scenario">
      <Page size="LETTER" style={styles.page}>
        <BrandRow note="Tabletop exercise scenario" />
        <Footer siteUrl={siteUrl} generatedOn={generatedOn} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {`${SCENARIO_TYPE_LABELS[scenario.type]} | About ${scenario.estimated_duration_minutes} minutes | ${scenario.injects.length} injects`}
        </Text>
        <Text style={styles.paragraph}>{toPdfText(scenario.summary)}</Text>

        <Text style={styles.h2}>How to run this exercise</Text>
        <View style={styles.box}>
          <BulletList
            ordered
            items={[
              "Book the room and the people for the estimated time. Assign the roles below before you start.",
              "Read the setting aloud, then one inject at a time. Give the group 8 to 10 minutes per inject.",
              "Ask the discussion questions. Keep the expected actions to yourself until the group has answered.",
              "Have the Scribe record each decision, who made it and when, on the after-action template at the end of this document.",
              "Finish with the wrap-up questions, then write down gaps and action items with an owner and a due date.",
            ]}
          />
        </View>

        <Text style={styles.h2}>Setting</Text>
        <View style={styles.box}>
          <Text style={styles.label}>Company</Text>
          <Text style={styles.paragraph}>{toPdfText(scenario.setting.company_profile)}</Text>
          <Text style={styles.label}>When</Text>
          <Text style={styles.paragraph}>{toPdfText(scenario.setting.day_and_time)}</Text>
          <Text style={styles.label}>First sign of trouble</Text>
          <Text style={styles.paragraph}>{toPdfText(scenario.setting.initial_signal)}</Text>
        </View>

        <Text style={styles.h2}>Roles</Text>
        <Table
          columns={[
            { header: "Role", flex: 3 },
            { header: "In this exercise", flex: 8 },
          ]}
          rows={scenario.roles.map((role) => [
            toPdfText(role.name),
            toPdfText(role.responsibilities),
          ])}
        />

        <Text style={styles.h2}>Objectives</Text>
        <BulletList ordered items={scenario.objectives} />

        <Text style={styles.h2} minPresenceAhead={80}>
          Timeline
        </Text>
        {scenario.injects.map((inject, position) => (
          <View key={position} style={styles.inject}>
            <View wrap={false}>
              <Text style={styles.injectTag}>
                {`INJECT ${position + 1} | ${inject.offset_minutes === 0 ? "START" : `+${inject.offset_minutes} MIN`}`}
              </Text>
              <Text style={styles.h3}>{toPdfText(inject.title)}</Text>
            </View>
            <Text style={styles.paragraph}>{toPdfText(inject.narrative)}</Text>
            <Text style={styles.label}>Discussion questions</Text>
            <BulletList items={inject.questions} />
            <View style={styles.facilitator}>
              <Text style={styles.label}>Expected actions (facilitator only)</Text>
              <BulletList items={inject.expected_actions} />
              {inject.framework_refs.length > 0 && (
                <Text style={styles.small}>
                  {`Gives evidence toward: ${inject.framework_refs.join(", ")}`}
                </Text>
              )}
            </View>
          </View>
        ))}

        <Text style={styles.h2}>Wrap-up questions</Text>
        <BulletList ordered items={scenario.wrap_up_questions} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <BrandRow note="After-action report template" />
        <Footer siteUrl={siteUrl} generatedOn={generatedOn} />
        <Text style={styles.title}>After-action report</Text>
        <Text style={styles.meta}>
          Fill this in during and straight after the exercise. A completed, dated report is the
          record that the plan was tested.
        </Text>

        <Text style={styles.h2}>Exercise details</Text>
        <Field label="Organization" />
        <Field label="Exercise title" value={title} />
        <Field label="Date" />
        <Field label="Start and end time" />
        <Field label="Facilitator" />
        <Field label="Plan version tested" />

        <Text style={styles.h2}>Participants</Text>
        <Table
          rowHeight={22}
          columns={[
            { header: "Name", flex: 4 },
            { header: "Role in the exercise", flex: 4 },
            { header: "Attended", flex: 2 },
            { header: "Signed off", flex: 2 },
          ]}
          rows={[
            ...scenario.roles.map((role) => ["", toPdfText(role.name), "", ""]),
            ...blankRows(Math.max(0, 6 - scenario.roles.length), 4),
          ]}
        />

        <Text style={styles.h2}>Scenario and injects used</Text>
        <Text style={styles.paragraph}>{toPdfText(scenario.summary)}</Text>
        <Table
          columns={[
            { header: "Inject", flex: 9 },
            { header: "Used (yes / no)", flex: 3 },
          ]}
          rows={scenario.injects.map((inject, position) => [
            `${position + 1}. ${toPdfText(inject.title)}`,
            "",
          ])}
        />

        <Text style={styles.h2} minPresenceAhead={80}>
          Decision timeline
        </Text>
        <Table
          rowHeight={30}
          columns={[
            { header: "Time", flex: 2 },
            { header: "Inject", flex: 2 },
            { header: "Who decided", flex: 3 },
            { header: "Decision", flex: 8 },
          ]}
          rows={blankRows(12, 4)}
        />

        <Text style={styles.h2}>Strengths observed</Text>
        <WriteLines count={4} />

        <Text style={styles.h2} minPresenceAhead={80}>
          Gaps
        </Text>
        <Table
          rowHeight={30}
          columns={[
            { header: "Gap", flex: 9 },
            { header: "Severity (low / medium / high)", flex: 4 },
          ]}
          rows={blankRows(6, 2)}
        />

        <Text style={styles.h2}>Action items</Text>
        <Table
          rowHeight={30}
          columns={[
            { header: "Action", flex: 8 },
            { header: "Owner", flex: 3 },
            { header: "Due date", flex: 2 },
          ]}
          rows={blankRows(6, 3)}
        />

        <Text style={styles.h2} minPresenceAhead={80}>
          Control mapping
        </Text>
        <Text style={styles.paragraph}>
          The controls this exercise can give evidence toward. Mark each one the session actually
          covered.
        </Text>
        <Table
          columns={[
            { header: "Control", flex: 3 },
            { header: "What it asks for", flex: 7 },
            { header: "Covered (yes / no)", flex: 2 },
          ]}
          rows={controls.map((ref) => [ref, FRAMEWORK_REF_SUMMARIES[ref], ""])}
        />
        <Text style={styles.small}>
          This report is evidence that an exercise took place and what it found. It does not, on its
          own, make an organization compliant with any framework.
        </Text>

        <Text style={styles.h2}>Attestation</Text>
        <Text style={styles.paragraph}>
          I confirm this report is an accurate record of the exercise described above.
        </Text>
        <Field label="Facilitator name" />
        <Field label="Signature" />
        <Field label="Date" />
        <Field label="Approved by (name, title)" />
        <Field label="Signature and date" />
      </Page>
    </Document>
  );
}
