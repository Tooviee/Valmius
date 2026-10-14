const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’‚′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[‐-―−]/g, "-"],
  [/…/g, "..."],
  [/[  -  ]/g, " "],
  [/→/g, "->"],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/•/g, "-"],
];

/**
 * Makes text safe for the PDF's built-in Helvetica font, which can only draw Latin-1.
 * Typographic punctuation is mapped to plain equivalents; anything else it cannot
 * draw is removed rather than rendered as a broken glyph.
 */
export function toPdfText(text: string): string {
  return toPdfInline(text).trim();
}

/**
 * The same cleanup without trimming, for a run of inline text whose leading or trailing
 * space separates it from a differently styled neighbour ("The " + "**Incident Commander**").
 */
export function toPdfInline(text: string): string {
  let result = text.normalize("NFKC");
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/[^\x20-\x7E¡-ÿ\n]/g, "");
}
