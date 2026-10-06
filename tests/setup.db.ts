import { loadSupabaseTestEnv } from "./helpers/env";

const { supabaseUrl } = loadSupabaseTestEnv();
const supabaseHost = new URL(supabaseUrl).host;
const realFetch = globalThis.fetch;

// Database tests may reach the Supabase project and nothing else.
const guardedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).host !== supabaseHost) {
    throw new Error(`Database tests may only call Supabase (attempted ${url}).`);
  }
  return realFetch(input, init);
};

globalThis.fetch = guardedFetch;
