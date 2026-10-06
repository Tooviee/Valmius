import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const SUPABASE_TEST_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "IP_HASH_SALT",
] as const;

/**
 * Copies only the Supabase settings from .env.local into process.env.
 * The real ANTHROPIC_API_KEY is deliberately left out of test processes.
 */
export function loadSupabaseTestEnv() {
  const fileEnv = parseEnv(readFileSync(".env.local", "utf8"));
  for (const key of SUPABASE_TEST_KEYS) {
    const value = process.env[key] ?? fileEnv[key];
    if (!value) throw new Error(`${key} is missing from .env.local`);
    process.env[key] = value;
  }
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    secretKey: process.env.SUPABASE_SECRET_KEY as string,
    ipHashSalt: process.env.IP_HASH_SALT as string,
  };
}
