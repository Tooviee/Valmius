import type { Blockquote, List, ListItem, PhrasingContent, Root, RootContent, Table } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/**
 * A small block model between markdown and the PDF and DOCX renderers. Both exports
 * consume these blocks, so a construct either renders in both or in neither.
 */

export type InlineRun = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: InlineRun[] }
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "list"; ordered: boolean; items: BlockListItem[] }
  | { type: "table"; header: InlineRun[][]; rows: InlineRun[][][] }
  | { type: "quote"; blocks: Block[] }
  | { type: "code"; text: string }
  | { type: "rule" };

export type BlockListItem = { runs: InlineRun[]; blocks: Block[] };

const processor = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(markdown: string): Root {
  return processor.parse(markdown);
}

type Style = { bold?: boolean; italic?: boolean; code?: boolean };

function inlineRuns(nodes: PhrasingContent[], style: Style = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        runs.push({ text: node.value, ...style });
        break;
      case "strong":
        runs.push(...inlineRuns(node.children, { ...style, bold: true }));
        break;
      case "emphasis":
        runs.push(...inlineRuns(node.children, { ...style, italic: true }));
        break;
      case "delete":
        runs.push(...inlineRuns(node.children, style));
        break;
      case "inlineCode":
        runs.push({ text: node.value, ...style, code: true });
        break;
      case "link":
        runs.push(...inlineRuns(node.children, style));
        break;
      case "break":
        runs.push({ text: "\n", ...style });
        break;
      case "image":
        if (node.alt) runs.push({ text: node.alt, ...style });
        break;
      default:
        // html, footnotes and anything else the renderers cannot draw are dropped.
        break;
    }
  }
  return mergeRuns(runs);
}

function mergeRuns(runs: InlineRun[]): InlineRun[] {
  const merged: InlineRun[] = [];
  for (const run of runs) {
    const last = merged.at(-1);
    if (
      last &&
      Boolean(last.bold) === Boolean(run.bold) &&
      Boolean(last.italic) === Boolean(run.italic) &&
      Boolean(last.code) === Boolean(run.code)
    ) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged.filter((run) => run.text.length > 0);
}

function listItem(item: ListItem): BlockListItem {
  const [first, ...rest] = item.children;
  const runs = first?.type === "paragraph" ? inlineRuns(first.children) : [];
  const trailing = first && first.type !== "paragraph" ? [first, ...rest] : rest;
  return { runs, blocks: trailing.flatMap((child) => toBlocks(child)) };
}

function list(node: List): Block {
  return { type: "list", ordered: Boolean(node.ordered), items: node.children.map(listItem) };
}

function table(node: Table): Block {
  const [headerRow, ...bodyRows] = node.children;
  const cells = (row: Table["children"][number]) =>
    row.children.map((cell) => inlineRuns(cell.children));
  return {
    type: "table",
    header: headerRow ? cells(headerRow) : [],
    rows: bodyRows.map(cells),
  };
}

function quote(node: Blockquote): Block {
  return { type: "quote", blocks: node.children.flatMap((child) => toBlocks(child)) };
}

function toBlocks(node: RootContent): Block[] {
  switch (node.type) {
    case "heading":
      return [{ type: "heading", level: node.depth, runs: inlineRuns(node.children) }];
    case "paragraph": {
      const runs = inlineRuns(node.children);
      return runs.length > 0 ? [{ type: "paragraph", runs }] : [];
    }
    case "list":
      return [list(node)];
    case "table":
      return [table(node)];
    case "blockquote":
      return [quote(node)];
    case "code":
      return [{ type: "code", text: node.value }];
    case "thematicBreak":
      return [{ type: "rule" }];
    default:
      return [];
  }
}

/** Parses markdown into blocks. Unsupported constructs are dropped, never rendered raw. */
export function markdownToBlocks(markdown: string): Block[] {
  return parseMarkdown(markdown).children.flatMap((node) => toBlocks(node));
}

export function runsToText(runs: InlineRun[]): string {
  return runs.map((run) => run.text).join("");
}
