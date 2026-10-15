import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_REALM = "Valmius admin";

/** Compares two strings in constant time, whatever their lengths. */
function secretsMatch(supplied: string, expected: string): boolean {
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Checks an HTTP Basic `Authorization` header against ADMIN_PASSWORD.
 * Any username is accepted; an unset password denies everyone.
 */
export function isAdminAuthorized(
  authorization: string | null | undefined,
  password: string | undefined = process.env.ADMIN_PASSWORD,
): boolean {
  if (!password || !authorization || !/^Basic\s+/i.test(authorization)) return false;

  const decoded = Buffer.from(authorization.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;

  return secretsMatch(decoded.slice(separator + 1), password);
}
