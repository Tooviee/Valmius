import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { markdownToBlocks, type Block, type InlineRun } from "@/lib/markdown/blocks";
import { approvalLine, footerLine, formatPlanDate, type PlanExportInput } from "@/lib/plan/export";
import { toPdfInline, toPdfText } from "./text";

const colors = { text: "#171717", muted: "#525252", line: "#c4c4c4", fill: "#f4f4f5" };
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
  title: { fontFamily: "Helvetica-Bold", fontSize: 22, lineHeight: 1.2, marginBottom: 6 },
  subtitle: { fontSize: 12, lineHeight: lineHeight(12), marginBottom: 4 },
  meta: { fontSize: 9.5, lineHeight: lineHeight(9.5), color: colors.muted, marginBottom: 3 },
  draftBanner: {
    marginTop: 14,
    marginBottom: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.text,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  toc: { marginTop: 16 },
  tocItem: { fontSize: 10, lineHeight: lineHeight(10), marginBottom: 2 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 14, marginTop: 18, marginBottom: 4 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 10, marginBottom: 4 },
  h4: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 3 },
  refs: { fontSize: 8.5, lineHeight: lineHeight(8.5), color: colors.muted, marginBottom: 8 },
  paragraph: { lineHeight: lineHeight(10), marginBottom: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  boldItalic: { fontFamily: "Helvetica-BoldOblique" },
  code: { fontFamily: "Courier", fontSize: 9 },
  listItem: { flexDirection: "row", marginBottom: 2.5 },
  listMarker: { width: 16, lineHeight: lineHeight(10) },
  listBody: { flex: 1 },
  listText: { lineHeight: lineHeight(10) },
  nested: { marginTop: 2, marginBottom: 2 },
  table: { marginBottom: 8 },
  row: { flexDirection: "row" },
  cell: {
    flex: 1,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: colors.line,
    paddingVertical: 3.5,
    paddingHorizontal: 5,
    fontSize: 8.5,
    lineHeight: lineHeight(8.5),
  },
  firstCell: { borderLeftWidth: 0.75 },
  headerCell: { borderTopWidth: 0.75, backgroundColor: colors.fill, fontFamily: "Helvetica-Bold" },
  quote: {
    backgroundColor: colors.fill,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 9,
    marginBottom: 8,
  },
  codeBlock: {
    backgroundColor: colors.fill,
    padding: 8,
    marginBottom: 8,
    fontFamily: "Courier",
    fontSize: 8.5,
    lineHeight: lineHeight(8.5),
  },
  rule: { borderBottomWidth: 0.75, borderBottomColor: colors.line, marginVertical: 8 },
  footerLeft: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 150,
    fontSize: 7.5,
    color: colors.muted,
  },
  footerRight: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    fontSize: 7.5,
    color: colors.muted,
    textAlign: "right",
  },
});

function Runs({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
        const style = run.code
          ? styles.code
          : run.bold && run.italic
            ? styles.boldItalic
            : run.bold
              ? styles.bold
              : run.italic
                ? styles.italic
                : undefined;
        return (
          <Text key={index} style={style}>
            {toPdfInline(run.text)}
          </Text>
        );
      })}
    </>
  );
}

function ListBlock({ block, depth }: { block: Extract<Block, { type: "list" }>; depth: number }) {
  return (
    <View style={depth > 0 ? styles.nested : undefined}>
      {block.items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text style={styles.listMarker}>{block.ordered ? `${index + 1}.` : "-"}</Text>
          <View style={styles.listBody}>
            {item.runs.length > 0 && (
              <Text style={styles.listText}>
                <Runs runs={item.runs} />
              </Text>
            )}
            {item.blocks.map((child, childIndex) => (
              <Blocks key={childIndex} blocks={[child]} depth={depth + 1} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TableBlock({ block }: { block: Extract<Block, { type: "table" }> }) {
  const renderRow = (cells: InlineRun[][], rowIndex: number, header: boolean) => (
    <View key={rowIndex} style={styles.row} wrap={false}>
      {cells.map((cell, cellIndex) => (
        <Text
          key={cellIndex}
          style={[
            styles.cell,
            cellIndex === 0 ? styles.firstCell : {},
            header ? styles.headerCell : {},
          ]}
        >
          <Runs runs={cell} />
        </Text>
      ))}
    </View>
  );
  return (
    <View style={styles.table}>
      {block.header.length > 0 && renderRow(block.header, -1, true)}
      {block.rows.map((row, index) => renderRow(row, index, false))}
    </View>
  );
}

function Blocks({ blocks, depth = 0 }: { blocks: Block[]; depth?: number }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Text
                key={index}
                style={block.level <= 3 ? styles.h3 : styles.h4}
                minPresenceAhead={40}
              >
                <Runs runs={block.runs} />
              </Text>
            );
          case "paragraph":
            return (
              <Text key={index} style={styles.paragraph}>
                <Runs runs={block.runs} />
              </Text>
            );
          case "list":
            return <ListBlock key={index} block={block} depth={depth} />;
          case "table":
            return <TableBlock key={index} block={block} />;
          case "quote":
            return (
              <View key={index} style={styles.quote}>
                <Blocks blocks={block.blocks} depth={depth} />
              </View>
            );
          case "code":
            return (
              <Text key={index} style={styles.codeBlock}>
                {toPdfText(block.text)}
              </Text>
            );
          case "rule":
            return <View key={index} style={styles.rule} />;
        }
      })}
    </>
  );
}

function Footer({ input }: { input: PlanExportInput }) {
  return (
    <>
      <Text style={styles.footerLeft} fixed>
        {toPdfText(footerLine(input))}
      </Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </>
  );
}

/** The IR plan as a PDF: cover block, contents, then the 11 sections, footer on every page. */
export function PlanDocument({ input }: { input: PlanExportInput }) {
  const { plan, orgName, timeZone } = input;
  const title = toPdfText(`${orgName}: Incident Response Plan`);
  return (
    <Document title={title} author="Valmius" subject="Incident response plan">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandRow} fixed>
          <Text style={styles.brand}>Valmius</Text>
          <Text style={styles.brandNote}>
            {toPdfText(`Incident response plan, version ${plan.version}`)}
          </Text>
        </View>
        <Footer input={input} />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{toPdfText(`Version ${plan.version}`)}</Text>
        <Text style={styles.meta}>{toPdfText(approvalLine(input))}</Text>
        <Text style={styles.meta}>
          {toPdfText(
            `Version created ${formatPlanDate(plan.created_at, timeZone)}; exported ${formatPlanDate(input.generatedAt, timeZone)}`,
          )}
        </Text>
        {plan.status !== "approved" && (
          <Text style={styles.draftBanner}>
            DRAFT. This version has not been approved. It is not the plan in force.
          </Text>
        )}

        <View style={styles.toc}>
          <Text style={styles.h3}>Contents</Text>
          {plan.sections.map((section, index) => (
            <Text key={section.id} style={styles.tocItem}>
              {toPdfText(`${index + 1}. ${section.title}`)}
            </Text>
          ))}
        </View>

        {plan.sections.map((section, index) => (
          <View key={section.id}>
            <Text style={styles.h2} minPresenceAhead={60}>
              {toPdfText(`${index + 1}. ${section.title}`)}
            </Text>
            {section.framework_refs.length > 0 && (
              <Text style={styles.refs}>
                {toPdfText(`Gives evidence toward: ${section.framework_refs.join(", ")}`)}
              </Text>
            )}
            <Blocks blocks={markdownToBlocks(section.markdown)} />
          </View>
        ))}
      </Page>
    </Document>
  );
}
