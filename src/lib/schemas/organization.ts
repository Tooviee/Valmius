import { z } from "zod";
import { HEADCOUNT_BANDS, INDUSTRIES } from "./generator";

/** Compliance obligations, questionnaire question 2 (SPEC.md section 8.1). */
export const FRAMEWORKS = [
  "soc2",
  "pci_dss",
  "hipaa",
  "iso_27001",
  "cmmc_nist_800_171",
  "nydfs_500",
  "cyber_insurance",
  "none",
] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  soc2: "SOC 2",
  pci_dss: "PCI DSS",
  hipaa: "HIPAA",
  iso_27001: "ISO 27001",
  cmmc_nist_800_171: "CMMC / NIST 800-171",
  nydfs_500: "NYDFS 500",
  cyber_insurance: "Cyber insurance only",
  none: "None yet",
};

export const ORG_NAME_MAX_LENGTH = 120;

let timeZones: Set<string> | undefined;

/** True for an IANA zone name the runtime knows, such as "America/New_York" or "UTC". */
export function isTimeZone(value: string): boolean {
  timeZones ??= new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  return timeZones.has(value);
}

/** What the onboarding form submits. Mirrors the organizations table's constraints. */
export const organizationInputSchema = z.object({
  name: z.string().trim().min(1).max(ORG_NAME_MAX_LENGTH),
  industry: z.enum(INDUSTRIES),
  headcountBand: z.enum(HEADCOUNT_BANDS),
  frameworks: z
    .array(z.enum(FRAMEWORKS))
    .max(FRAMEWORKS.length)
    .transform((values) => [...new Set(values)])
    .default([]),
  timezone: z.string().trim().max(64).refine(isTimeZone, "Choose a time zone."),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
