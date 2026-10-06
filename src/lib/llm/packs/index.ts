import type { HostingOption, Industry } from "@/lib/schemas/generator";
import { scenarioSchema, type PackScenarioType, type Scenario } from "@/lib/schemas/scenario";
import becA from "./bec-a.json";
import becB from "./bec-b.json";
import becC from "./bec-c.json";
import cloudCredentialA from "./cloud-credential-a.json";
import cloudCredentialB from "./cloud-credential-b.json";
import cloudCredentialC from "./cloud-credential-c.json";
import ransomwareA from "./ransomware-a.json";
import ransomwareB from "./ransomware-b.json";
import ransomwareC from "./ransomware-c.json";
import vendorBreachA from "./vendor-breach-a.json";
import vendorBreachB from "./vendor-breach-b.json";
import vendorBreachC from "./vendor-breach-c.json";

export type PackVariant = "a" | "b" | "c";

/** The kind of company each variant was written for. Used to pick the closest one. */
export const VARIANT_PROFILES: Record<
  PackVariant,
  { description: string; hosting: HostingOption[]; industries: Industry[] }
> = {
  a: {
    description: "Cloud-hosted B2B software company",
    hosting: ["aws", "gcp", "azure", "vercel_netlify"],
    industries: ["saas_software", "ecommerce_retail", "education"],
  },
  b: {
    description: "SaaS-only professional services firm",
    hosting: ["saas_only"],
    industries: ["professional_services", "nonprofit"],
  },
  c: {
    description: "Regulated company with some on-prem systems",
    hosting: ["on_prem"],
    industries: ["healthcare", "financial_services", "manufacturing"],
  },
};

export type SeededPack = {
  slug: string;
  type: PackScenarioType;
  variant: PackVariant;
  scenario: Scenario;
};

function pack(type: PackScenarioType, variant: PackVariant, json: unknown): SeededPack {
  const scenario = scenarioSchema.parse(json);
  if (scenario.type !== type) {
    throw new Error(`Seeded pack ${type}-${variant} has type "${scenario.type}"`);
  }
  return { slug: `${type.replace("_", "-")}-${variant}`, type, variant, scenario };
}

/**
 * The seeded scenario packs: 4 types, 3 variants each (SPEC.md sections 5 and 8.3).
 * They are bundled with the app so the fallback works even when the database is down;
 * `pnpm db:seed` stores the same content in `scenarios`.
 */
export const SEEDED_PACKS: SeededPack[] = [
  pack("ransomware", "a", ransomwareA),
  pack("ransomware", "b", ransomwareB),
  pack("ransomware", "c", ransomwareC),
  pack("bec", "a", becA),
  pack("bec", "b", becB),
  pack("bec", "c", becC),
  pack("cloud_credential", "a", cloudCredentialA),
  pack("cloud_credential", "b", cloudCredentialB),
  pack("cloud_credential", "c", cloudCredentialC),
  pack("vendor_breach", "a", vendorBreachA),
  pack("vendor_breach", "b", vendorBreachB),
  pack("vendor_breach", "c", vendorBreachC),
];
