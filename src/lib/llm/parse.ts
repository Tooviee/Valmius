export type ParsedJson = { ok: true; value: unknown } | { ok: false };

function tryParse(text: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Parses a model response as JSON. Accepts the bare object, an object inside a
 * Markdown code fence, or an object with stray prose around it.
 */
export function parseJsonResponse(text: string): ParsedJson {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct.ok) return direct;

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1]) {
    const fromFence = tryParse(fenced[1]);
    if (fromFence.ok) return fromFence;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return tryParse(trimmed.slice(start, end + 1));
  }

  return { ok: false };
}
