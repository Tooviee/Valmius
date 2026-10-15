import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

/** Limits per IP for public endpoints (SPEC.md sections 5 and 11) and per org for model spend. */
export const RATE_LIMITS = {
  // The limit the spec sets: 5 generations per hour.
  generate: { prefix: "gen", limit: 5, windowSeconds: 3600 },
  lead: { prefix: "lead", limit: 10, windowSeconds: 3600 },
  pdf: { prefix: "pdf", limit: 20, windowSeconds: 3600 },
  // Page-view tracking, so the events table cannot be flooded.
  view: { prefix: "view", limit: 60, windowSeconds: 3600 },
  // Counts failed admin sign-ins only.
  admin_login: { prefix: "admin", limit: 10, windowSeconds: 3600 },
  // Magic-link requests. Supabase has its own email limit; this one keeps the form from
  // being used to flood someone's inbox.
  login: { prefix: "login", limit: 10, windowSeconds: 3600 },
  // Per organization (the key is the org id): whole-plan generations and single-section
  // rewrites, so one account cannot run up the model spend.
  plan_generate: { prefix: "plan", limit: 10, windowSeconds: 3600 },
  plan_section: { prefix: "psec", limit: 30, windowSeconds: 3600 },
  // Scenarios generated from the plan for an exercise, per organization.
  scenario_custom: { prefix: "scus", limit: 10, windowSeconds: 3600 },
  // Participant actions (attendance, sign-off) per IP: tokens are unguessable, this just
  // keeps a misbehaving client from hammering the lookup.
  participant: { prefix: "part", limit: 120, windowSeconds: 3600 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** "unavailable" means the limiter itself could not be reached. */
export type RateLimitResult = "allowed" | "blocked" | "unavailable";

type BumpArgs = { p_key: string; p_limit: number; p_window_seconds: number };
type BumpResult = { data: boolean | null; error: { message: string } | null };
export type BumpRateLimit = (args: BumpArgs) => PromiseLike<BumpResult>;

const bumpInDatabase: BumpRateLimit = (args) => getAdminClient().rpc("bump_rate_limit", args);

/** `subject` is the IP hash for public endpoints, or the organization id for app limits. */
export function rateLimitKey(name: RateLimitName, subject: string): string {
  return `${RATE_LIMITS[name].prefix}:${subject}`;
}

/**
 * Counts one request against a limit using the atomic `bump_rate_limit` RPC.
 * `bump` is injectable so the wrapper can be tested without a database.
 */
export async function checkRateLimit(
  name: RateLimitName,
  subject: string,
  bump: BumpRateLimit = bumpInDatabase,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  try {
    const { data, error } = await bump({
      p_key: rateLimitKey(name, subject),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error || typeof data !== "boolean") {
      console.error(`[rate-limit] ${name} check failed: ${error?.message ?? "no result"}`);
      return "unavailable";
    }
    return data ? "allowed" : "blocked";
  } catch (error) {
    console.error(`[rate-limit] ${name} check failed:`, error);
    return "unavailable";
  }
}
