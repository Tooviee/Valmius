import { createHash } from "node:crypto";

/** SHA-256 of a file, lowercase hex, as `sha256sum` prints it. */
export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Deterministic JSON (sorted keys), so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/**
 * A fingerprint of the report content, printed inside the PDF. The PDF's own hash cannot
 * appear inside the file it hashes, so the file hash lives in the evidence vault instead.
 */
export function contentFingerprint(content: unknown): string {
  return sha256Hex(canonicalJson(content));
}
