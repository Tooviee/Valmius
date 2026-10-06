import { z } from "zod";
import { FRAMEWORK_REFS } from "./frameworks";

/** Every type a stored scenario can have (SPEC.md section 8.3). */
export const SCENARIO_TYPES = [
  "ransomware",
  "bec",
  "cloud_credential",
  "vendor_breach",
  "custom",
] as const;
export const scenarioTypeSchema = z.enum(SCENARIO_TYPES);
export type ScenarioType = z.infer<typeof scenarioTypeSchema>;

/** The four seeded pack types, which are also what the public generator offers. */
export const PACK_SCENARIO_TYPES = [
  "ransomware",
  "bec",
  "cloud_credential",
  "vendor_breach",
] as const;
export const packScenarioTypeSchema = z.enum(PACK_SCENARIO_TYPES);
export type PackScenarioType = z.infer<typeof packScenarioTypeSchema>;

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  ransomware: "Ransomware",
  bec: "Business email compromise",
  cloud_credential: "Cloud credential compromise",
  vendor_breach: "Vendor breach",
  custom: "Custom",
};

/** What each pack type covers (SPEC.md section 8.3). Shown on the form and given to the model. */
export const SCENARIO_TYPE_BRIEFS: Record<PackScenarioType, string> = {
  ransomware:
    "A file server or SaaS backup is encrypted, a ransom note appears, and the backups turn out to be questionable.",
  bec: "Someone impersonating the CEO asks finance for a wire transfer, and then a real mailbox compromise is discovered.",
  cloud_credential:
    "An API key is leaked in a public code repository, an unexpected cloud bill arrives, and the question becomes whether data was taken.",
  vendor_breach:
    "A critical SaaS vendor announces a breach, customer data may be exposed, and a contractual notification clock starts.",
};

// Length caps keep a scenario posted back by a browser (the PDF route) to a bounded size.
const text = (max: number) => z.string().min(1).max(max);

export const injectSchema = z.object({
  index: z.number().int().min(0),
  offset_minutes: z.number().int().min(0).max(480),
  title: text(200),
  narrative: text(3000),
  questions: z.array(text(600)).min(2).max(4),
  expected_actions: z.array(text(600)).min(2).max(4),
  framework_refs: z.array(z.enum(FRAMEWORK_REFS)).max(8),
});

/** Scenario content, exactly as SPEC.md section 8.3 defines it. */
export const scenarioSchema = z.object({
  title: text(200),
  type: scenarioTypeSchema,
  summary: text(2000),
  setting: z.object({
    company_profile: text(1000),
    day_and_time: text(200),
    initial_signal: text(1000),
  }),
  roles: z
    .array(z.object({ name: text(120), responsibilities: text(1000) }))
    .min(3)
    .max(6),
  objectives: z.array(text(500)).min(3).max(5),
  injects: z.array(injectSchema).min(5).max(7),
  wrap_up_questions: z.array(text(600)).min(3).max(5),
  estimated_duration_minutes: z.number().int().min(45).max(120),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioInject = z.infer<typeof injectSchema>;
