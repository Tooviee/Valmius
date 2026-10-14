import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import { markdownToBlocks, type Block, type InlineRun } from "@/lib/markdown/blocks";
import { approvalLine, footerLine, formatPlanDate, type PlanExportInput } from "@/lib/plan/export";

/**
 * The IR plan as a Word document, built from the same blocks as the PDF. Ordered lists
 * restart numbering per list; the footer shows version, approval and page numbers.
 */

const ORDERED = "plan-ordered";
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "C4C4C4" };
const CELL_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
};

function runs(items: InlineRun[], extra: { size?: number; color?: string } = {}): ParagraphChild[] {
  return items.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italic,
        font: run.code ? "Consolas" : undefined,
        ...extra,
      }),
  );
}

class Builder {
  private orderedInstance = 0;

  constructor(private readonly paragraphs: (Paragraph | Table)[] = []) {}

  get children() {
    return this.paragraphs;
  }

  add(block: Block, depth = 0): void {
    switch (block.type) {
      case "heading":
        this.paragraphs.push(
          new Paragraph({
            heading: block.level <= 3 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            children: runs(block.runs),
          }),
        );
        return;
      case "paragraph":
        this.paragraphs.push(
          new Paragraph({
            children: runs(block.runs),
            spacing: { after: 120 },
            indent: indentFor(depth),
          }),
        );
        return;
      case "list": {
        const instance = block.ordered ? ++this.orderedInstance : 0;
        for (const item of block.items) {
          this.paragraphs.push(
            new Paragraph({
              children: runs(item.runs),
              spacing: { after: 60 },
              ...(block.ordered
                ? { numbering: { reference: ORDERED, level: Math.min(depth, 2), instance } }
                : { bullet: { level: Math.min(depth, 2) } }),
            }),
          );
          for (const child of item.blocks) this.add(child, depth + 1);
        }
        return;
      }
      case "table":
        this.paragraphs.push(table(block));
        this.paragraphs.push(new Paragraph({ spacing: { after: 60 } }));
        return;
      case "quote":
        for (const child of block.blocks) {
          if (child.type === "paragraph") {
            this.paragraphs.push(
              new Paragraph({
                children: runs(child.runs, { color: "525252" }),
                indent: { left: 720 },
                spacing: { after: 120 },
                border: {
                  left: { style: BorderStyle.SINGLE, size: 12, color: "C4C4C4", space: 8 },
                },
              }),
            );
          } else {
            this.add(child, depth + 1);
          }
        }
        return;
      case "code":
        this.paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, font: "Consolas", size: 18 })],
            shading: { type: ShadingType.CLEAR, fill: "F4F4F5" },
            spacing: { after: 120 },
          }),
        );
        return;
      case "rule":
        this.paragraphs.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C4C4C4" } },
            spacing: { after: 120 },
          }),
        );
        return;
    }
  }
}

const indentFor = (depth: number) => (depth > 0 ? { left: 720 * depth } : undefined);

function table(block: Extract<Block, { type: "table" }>): Table {
  const columns = Math.max(block.header.length, ...block.rows.map((row) => row.length), 1);
  const width = Math.floor(100 / columns);
  const row = (cells: InlineRun[][], header: boolean) =>
    new TableRow({
      tableHeader: header,
      children: Array.from({ length: columns }, (_, index) => {
        const cell = cells[index] ?? [];
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS,
          shading: header ? { type: ShadingType.CLEAR, fill: "F4F4F5" } : undefined,
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [
            new Paragraph({
              children: runs(header ? cell.map((run) => ({ ...run, bold: true })) : cell, {
                size: 19,
              }),
            }),
          ],
        });
      }),
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...(block.header.length > 0 ? [row(block.header, true)] : []),
      ...block.rows.map((cells) => row(cells, false)),
    ],
  });
}

export function buildPlanDocument(input: PlanExportInput): Document {
  const { plan, orgName, timeZone } = input;
  const builder = new Builder();

  builder.children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`${orgName}: Incident Response Plan`)],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Version ${plan.version}`, size: 26 })],
      spacing: { after: 60 },
    }),
    new Paragraph({ children: [new TextRun({ text: approvalLine(input), color: "525252" })] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Version created ${formatPlanDate(plan.created_at, timeZone)}; exported ${formatPlanDate(input.generatedAt, timeZone)}`,
          color: "525252",
        }),
      ],
      spacing: { after: 240 },
    }),
  );
  if (plan.status !== "approved") {
    builder.children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "DRAFT. This version has not been approved. It is not the plan in force.",
            bold: true,
          }),
        ],
        border: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
        spacing: { after: 240 },
      }),
    );
  }

  builder.children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Contents")] }),
  );
  plan.sections.forEach((section, index) => {
    builder.children.push(
      new Paragraph({ children: [new TextRun(`${index + 1}. ${section.title}`)] }),
    );
  });

  plan.sections.forEach((section, index) => {
    builder.children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: index === 0,
        children: [new TextRun(`${index + 1}. ${section.title}`)],
      }),
    );
    if (section.framework_refs.length > 0) {
      builder.children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Gives evidence toward: ${section.framework_refs.join(", ")}`,
              italics: true,
              color: "525252",
              size: 18,
            }),
          ],
          spacing: { after: 120 },
        }),
      );
    }
    for (const block of markdownToBlocks(section.markdown)) builder.add(block);
  });

  return new Document({
    creator: "Drill Day",
    title: `${orgName}: Incident Response Plan v${plan.version}`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
        heading1: {
          run: { size: 32, bold: true, color: "171717" },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        heading2: {
          run: { size: 26, bold: true, color: "171717" },
          paragraph: { spacing: { before: 240, after: 80 } },
        },
        heading3: {
          run: { size: 23, bold: true, color: "171717" },
          paragraph: { spacing: { before: 160, after: 60 } },
        },
        title: {
          run: { size: 44, bold: true, color: "171717" },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: ORDERED,
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${footerLine(input)} | Page `, size: 16, color: "525252" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "525252" }),
                  new TextRun({ text: " of ", size: 16, color: "525252" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "525252" }),
                ],
              }),
            ],
          }),
        },
        children: builder.children,
      },
    ],
  });
}

/** Renders the plan as a .docx file. */
export async function renderPlanDocx(input: PlanExportInput): Promise<Buffer> {
  return Packer.toBuffer(buildPlanDocument(input));
}
