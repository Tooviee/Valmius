"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { logEvent } from "@/lib/supabase/events";

/** Records that a visitor opened the generator page. */
export async function trackGeneratorViewed(): Promise<void> {
  const ipHash = getIpHash(await headers());
  if ((await checkRateLimit("view", ipHash)) !== "allowed") return;
  await logEvent("generator_viewed", {}, ipHash);
}
