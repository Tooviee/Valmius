import { describe, expect, it } from "vitest";
import { markdownToBlocks, runsToText } from "@/lib/markdown/blocks";
import fixtures from "../fixtures/llm/plan-sections.json";

describe("markdownToBlocks", () => {
  it("maps headings, paragraphs with inline styles, lists, tables, quotes and rules", () => {
    const blocks = markdownToBlocks(
      [
        "### Scope",
        "",
        "Plain, **bold** and *italic* text with `code`.",
        "",
        "- first",
        "- second with **bold**",
        "",
        "1. one",
        "2. two",
        "",
        "| Role | Who |",
        "| --- | --- |",
        "| IC | IT Manager |",
        "",
        "> A note.",
        "",
        "---",
      ].join("\n"),
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "table",
      "quote",
      "rule",
    ]);
    const [heading, paragraph, bullets, numbers, table, quote] = blocks;
    expect(heading).toMatchObject({ level: 3, runs: [{ text: "Scope" }] });
    expect(paragraph.type === "paragraph" && paragraph.runs).toEqual([
      { text: "Plain, " },
      { text: "bold", bold: true },
      { text: " and " },
      { text: "italic", italic: true },
      { text: " text with " },
      { text: "code", code: true },
      { text: "." },
    ]);
    expect(bullets).toMatchObject({ ordered: false });
    expect(bullets.type === "list" && bullets.items[1].runs).toEqual([
      { text: "second with " },
      { text: "bold", bold: true },
    ]);
    expect(numbers).toMatchObject({ ordered: true });
    expect(table.type === "table" && runsToText(table.header[1])).toBe("Who");
    expect(table.type === "table" && runsToText(table.rows[0][1])).toBe("IT Manager");
    expect(quote.type === "quote" && quote.blocks[0]).toMatchObject({ type: "paragraph" });
  });

  it("keeps nested lists under their parent item", () => {
    const [list] = markdownToBlocks("- parent\n  - child one\n  - child two\n- sibling");
    expect(list.type).toBe("list");
    if (list.type !== "list") return;
    expect(list.items).toHaveLength(2);
    expect(list.items[0].blocks[0]).toMatchObject({ type: "list", ordered: false });
    expect(list.items[0].blocks[0].type === "list" && list.items[0].blocks[0].items).toHaveLength(
      2,
    );
  });

  it("drops raw HTML and keeps link text", () => {
    const blocks = markdownToBlocks(
      "<script>alert(1)</script>\n\nSee [the policy](https://x.test).",
    );
    expect(blocks).toEqual([{ type: "paragraph", runs: [{ text: "See the policy." }] }]);
  });

  it("parses every plan fixture section into at least one block", () => {
    for (const [id, section] of Object.entries(fixtures)) {
      const blocks = markdownToBlocks(section.markdown);
      expect(blocks.length, id).toBeGreaterThan(0);
      expect(
        blocks.some((b) => b.type === "heading" && b.level === 1),
        id,
      ).toBe(false);
    }
    const appendices = markdownToBlocks(fixtures.appendices.markdown);
    expect(appendices.filter((b) => b.type === "table")).toHaveLength(3);
  });
});
