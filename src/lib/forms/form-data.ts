/**
 * Turns a submitted FormData into a plain nested object: "roles.legal.title" becomes
 * { roles: { legal: { title } } }, names in `arrayFields` collect every value, and empty
 * strings become undefined so optional fields validate as absent.
 */
export function formDataToObject(
  formData: FormData,
  arrayFields: ReadonlySet<string>,
  maxLength = 5000,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of formData.keys()) {
    if (seen.has(key) || key.startsWith("$")) continue;
    seen.add(key);
    const path = key.split(".");
    const root = path[0];
    let value: unknown;
    if (arrayFields.has(root)) {
      value = formData
        .getAll(key)
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.slice(0, maxLength));
    } else {
      const raw = formData.get(key);
      const text = typeof raw === "string" ? raw.slice(0, maxLength) : "";
      value = text.trim() === "" ? undefined : text;
    }

    let node = result;
    for (let i = 0; i < path.length - 1; i += 1) {
      const next = node[path[i]];
      if (typeof next !== "object" || next === null || Array.isArray(next)) {
        node[path[i]] = {};
      }
      node = node[path[i]] as Record<string, unknown>;
    }
    node[path[path.length - 1]] = value;
  }
  return result;
}
