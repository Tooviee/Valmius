// Inserts the seeded scenario packs into `scenarios` with the secret key: `pnpm db:seed`.
// Safe to re-run: each pack has a fixed id derived from its slug, so rows are upserted.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SEEDED_PACKS } from "../src/lib/llm/packs";
import { FRAMEWORK_REFS } from "../src/lib/schemas/frameworks";
import type { Database, Json } from "../src/lib/supabase/database.types";

// Fixed namespace for pack ids. Changing it would create a second set of rows.
const PACK_NAMESPACE = "6f1d3c0e-8b7a-4e59-9a54-2d1c7e0b5a11";

/** RFC 4122 version 5 UUID: stable for a given slug, so Phase 3 can reference packs by id. */
function packId(slug: string): string {
  const namespace = Buffer.from(PACK_NAMESPACE.replaceAll("-", ""), "hex");
  const bytes = createHash("sha1").update(namespace).update(slug).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  }
  const supabase = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // SEEDED_PACKS is already validated against the scenario schema when it is imported.
  const rows = SEEDED_PACKS.map((pack) => {
    const used = new Set(pack.scenario.injects.flatMap((inject) => inject.framework_refs));
    return {
      id: packId(pack.slug),
      org_id: null,
      type: pack.type,
      title: pack.scenario.title,
      content: pack.scenario as Json,
      framework_tags: FRAMEWORK_REFS.filter((ref) => used.has(ref)),
      is_pack: true,
    };
  });

  const { error } = await supabase.from("scenarios").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Seeding failed: ${error.message}`);

  const { data, error: readError } = await supabase
    .from("scenarios")
    .select("id, type")
    .eq("is_pack", true)
    .is("org_id", null);
  if (readError) throw new Error(`Could not read packs back: ${readError.message}`);

  const expectedIds = new Set(rows.map((row) => row.id));
  const unexpected = data.filter((row) => !expectedIds.has(row.id));
  const perType = Object.fromEntries(
    [...new Set(rows.map((row) => row.type))].map((type) => [
      type,
      data.filter((row) => row.type === type).length,
    ]),
  );

  console.log(`Seeded ${rows.length} scenario packs. Public packs now in the database:`, perType);
  if (unexpected.length > 0) {
    console.warn(
      `Warning: ${unexpected.length} public pack row(s) are not part of the current seed:`,
      unexpected.map((row) => row.id),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
