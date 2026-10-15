import { z } from "zod";
import { packScenarioTypeSchema } from "./scenario";

export const INDUSTRIES = [
  "saas_software",
  "financial_services",
  "healthcare",
  "ecommerce_retail",
  "professional_services",
  "manufacturing",
  "education",
  "nonprofit",
  "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  saas_software: "Software / SaaS",
  financial_services: "Financial services / fintech",
  healthcare: "Healthcare",
  ecommerce_retail: "E-commerce / retail",
  professional_services: "Professional services (legal, accounting, consulting)",
  manufacturing: "Manufacturing / logistics",
  education: "Education",
  nonprofit: "Nonprofit",
  other: "Other",
};

// Same bands as questionnaire question 1 (SPEC.md section 8.1).
export const HEADCOUNT_BANDS = ["1-10", "11-50", "51-200", "201+"] as const;
export type HeadcountBand = (typeof HEADCOUNT_BANDS)[number];

export const HOSTING_OPTIONS = [
  "aws",
  "gcp",
  "azure",
  "vercel_netlify",
  "on_prem",
  "saas_only",
] as const;
export type HostingOption = (typeof HOSTING_OPTIONS)[number];

export const HOSTING_LABELS: Record<HostingOption, string> = {
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  vercel_netlify: "Vercel/Netlify",
  on_prem: "On-prem servers",
  saas_only: "SaaS only",
};

export const CONTEXT_MAX_LENGTH = 500;
/** The plan facts block (Phase 3, "generate from my plan"); never set from a public form. */
export const PLAN_CONTEXT_MAX_LENGTH = 6000;

/** What the scenario generator takes: the public form's fields, plus plan context in Phase 3. */
export const generatorInputSchema = z.object({
  industry: z.enum(INDUSTRIES),
  headcountBand: z.enum(HEADCOUNT_BANDS),
  hosting: z
    .array(z.enum(HOSTING_OPTIONS))
    .min(1)
    .max(HOSTING_OPTIONS.length)
    .transform((values) => [...new Set(values)]),
  scenarioType: packScenarioTypeSchema,
  context: z.string().trim().max(CONTEXT_MAX_LENGTH).default(""),
  planContext: z.string().trim().max(PLAN_CONTEXT_MAX_LENGTH).default(""),
});

export type GeneratorInput = z.infer<typeof generatorInputSchema>;

const COMPANY_NOUNS: Record<Industry, string> = {
  saas_software: "Software company",
  financial_services: "Financial services company",
  healthcare: "Healthcare company",
  ecommerce_retail: "E-commerce and retail company",
  professional_services: "Professional services firm",
  manufacturing: "Manufacturing and logistics company",
  education: "Education organization",
  nonprofit: "Nonprofit organization",
  other: "Company",
};

const HEADCOUNT_PHRASES: Record<HeadcountBand, string> = {
  "1-10": "up to 10 employees",
  "11-50": "11 to 50 employees",
  "51-200": "51 to 200 employees",
  "201+": "more than 200 employees",
};

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** One or two plain sentences describing the visitor's company, built only from form values. */
export function describeCompany(
  input: Pick<GeneratorInput, "industry" | "headcountBand" | "hosting">,
): string {
  const company = `${COMPANY_NOUNS[input.industry]} with ${HEADCOUNT_PHRASES[input.headcountBand]}.`;
  const platforms = input.hosting
    .filter((option) => option !== "saas_only")
    .map((option) => (option === "on_prem" ? "on-prem servers" : HOSTING_LABELS[option]));

  if (platforms.length === 0) {
    return `${company} It runs entirely on SaaS tools, with no servers of its own.`;
  }
  const saasNote = input.hosting.includes("saas_only") ? ", alongside SaaS tools" : "";
  return `${company} Its systems run on ${joinList(platforms)}${saasNote}.`;
}
