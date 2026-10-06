import "server-only";
import { createHmac } from "node:crypto";

/**
 * The client IP as the platform reports it. On Vercel, x-forwarded-for is overwritten
 * by the platform, so a visitor cannot spoof it to dodge the rate limit.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Keyed hash of an IP. Only this hash is stored (`events`, `rate_limits`), never the IP. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT must be set");
  return createHmac("sha256", salt).update(ip).digest("hex");
}

export function getIpHash(headers: Headers): string {
  return hashIp(getClientIp(headers));
}
