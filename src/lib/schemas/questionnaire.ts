import { z } from "zod";
import { HOSTING_OPTIONS } from "./generator";

/**
 * The 15-question questionnaire (SPEC.md section 8.1). Question 1 (company name, industry,
 * size, time zone) and the framework list in question 2 live on the organization row;
 * everything else is stored in questionnaires.answers and validated here.
 */

export const QUESTIONNAIRE_STEPS = [
  { step: 1, slug: "company", title: "Your company", questions: "Questions 1 and 2" },
  { step: 2, slug: "systems", title: "Systems and data", questions: "Questions 3 to 6" },
  { step: 3, slug: "people", title: "People and outside help", questions: "Questions 7 and 8" },
  {
    step: 4,
    slug: "defenses",
    title: "Defenses, backups and fallbacks",
    questions: "Questions 9, 10, 13 and 14",
  },
  {
    step: 5,
    slug: "obligations",
    title: "Obligations and review",
    questions: "Questions 11, 12 and 15",
  },
] as const;
export type QuestionnaireStep = (typeof QUESTIONNAIRE_STEPS)[number]["step"];
export const LAST_STEP: QuestionnaireStep = 5;

export const FREE_TEXT_MAX_LENGTH = 1000;
const SHORT_MAX_LENGTH = 200;

export const DATA_TYPES = [
  "customer_pii",
  "payment_card_data",
  "health_data",
  "source_code_ip",
  "employee_data",
  "financial_records",
] as const;
export const DATA_TYPE_LABELS: Record<(typeof DATA_TYPES)[number], string> = {
  customer_pii: "Customer personal data",
  payment_card_data: "Payment card data",
  health_data: "Health data",
  source_code_ip: "Source code / intellectual property",
  employee_data: "Employee data",
  financial_records: "Financial records",
};

export const IDENTITY_PROVIDERS = ["google_workspace", "microsoft_365", "okta", "other"] as const;
export const IDENTITY_PROVIDER_LABELS: Record<(typeof IDENTITY_PROVIDERS)[number], string> = {
  google_workspace: "Google Workspace",
  microsoft_365: "Microsoft 365",
  okta: "Okta",
  other: "Other",
};

export const MFA_STATUSES = ["yes", "no", "partial"] as const;
export const MFA_STATUS_LABELS: Record<(typeof MFA_STATUSES)[number], string> = {
  yes: "Yes, enforced for everyone",
  partial: "Partially (some people or systems)",
  no: "No",
};

export const MONITORING_OPTIONS = ["edr_antivirus", "siem_logs", "cloud_alerts", "none"] as const;
export const MONITORING_LABELS: Record<(typeof MONITORING_OPTIONS)[number], string> = {
  edr_antivirus: "EDR or antivirus on laptops and servers",
  siem_logs: "SIEM or log aggregation",
  cloud_alerts: "Cloud provider alerts (billing, GuardDuty, Security Center, etc.)",
  none: "None",
};

export const REGULATORY_OBLIGATIONS = [
  "state_breach_laws",
  "gdpr",
  "hipaa",
  "pci_card_brands",
  "nydfs",
  "sec",
  "none_known",
] as const;
export const REGULATORY_OBLIGATION_LABELS: Record<(typeof REGULATORY_OBLIGATIONS)[number], string> =
  {
    state_breach_laws: "US state breach notification laws",
    gdpr: "GDPR (72 hours to the supervisory authority)",
    hipaa: "HIPAA (60 days to HHS and affected individuals)",
    pci_card_brands: "PCI card brands and acquiring bank",
    nydfs: "NYDFS 500 (72 hours to the Department)",
    sec: "SEC (material incidents, Form 8-K within 4 business days)",
    none_known: "None known",
  };

export const OUT_OF_BAND_CHANNELS = [
  "phone_tree",
  "signal_group",
  "personal_email",
  "none",
] as const;
export const OUT_OF_BAND_LABELS: Record<(typeof OUT_OF_BAND_CHANNELS)[number], string> = {
  phone_tree: "Phone tree (a list of personal mobile numbers)",
  signal_group: "Signal or WhatsApp group",
  personal_email: "Personal email addresses",
  none: "None yet",
};

export const REVIEW_CADENCES = ["annual", "semi_annual", "quarterly"] as const;
export const REVIEW_CADENCE_LABELS: Record<(typeof REVIEW_CADENCES)[number], string> = {
  annual: "Annual",
  semi_annual: "Every six months",
  quarterly: "Quarterly",
};

export const YES_NO = ["yes", "no"] as const;

export const ROLE_KEYS = [
  "it_security_lead",
  "executive_decision_maker",
  "legal",
  "customer_communications",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export const ROLE_LABELS: Record<RoleKey, string> = {
  it_security_lead: "Leads IT and security",
  executive_decision_maker: "Executive decision maker",
  legal: "Handles legal and compliance",
  customer_communications: "Handles customer communications",
};

const shortText = z.string().trim().max(SHORT_MAX_LENGTH);
const freeText = z.string().trim().max(FREE_TEXT_MAX_LENGTH);
const optionalShort = shortText.optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.");

const unique = <T>(values: T[]) => [...new Set(values)];

export const roleSchema = z.object({
  title: shortText.min(1, "Enter a role title."),
  name: optionalShort,
  backup: optionalShort,
});

/** The full set of answers. A questionnaire is complete when this parses. */
export const questionnaireAnswersSchema = z.object({
  // Q2 (the framework list itself is organizations.frameworks)
  next_audit_date: isoDate.optional(),
  // Q3
  data_types: z.array(z.enum(DATA_TYPES)).transform(unique),
  // Q4
  hosting: z.array(z.enum(HOSTING_OPTIONS)).min(1, "Choose at least one.").transform(unique),
  // Q5
  identity_provider: z.enum(IDENTITY_PROVIDERS),
  identity_provider_other: optionalShort,
  mfa_status: z.enum(MFA_STATUSES),
  // Q6
  key_systems: freeText.min(3, "Name the systems your business runs on."),
  // Q7
  roles: z.object({
    it_security_lead: roleSchema,
    executive_decision_maker: roleSchema,
    legal: roleSchema,
    customer_communications: roleSchema,
  }),
  // Q8
  outside_parties: z.object({
    msp: optionalShort,
    outside_counsel: optionalShort,
    insurer_name: optionalShort,
    insurer_claims_phone: z.string().trim().max(60).optional(),
    forensics_retainer: z.enum(YES_NO),
  }),
  // Q9
  monitoring: z.array(z.enum(MONITORING_OPTIONS)).min(1, "Choose at least one.").transform(unique),
  // Q10
  backups: z.object({
    location: shortText.min(1, "Say where backups are kept."),
    frequency: shortText.min(1, "Say how often backups run."),
    last_restore_test: z.string().trim().min(1, 'Enter a date or "never".').max(100),
  }),
  // Q11
  customer_notification_obligations: freeText.optional(),
  // Q12
  regulatory_obligations: z
    .array(z.enum(REGULATORY_OBLIGATIONS))
    .min(1, "Choose at least one, or none known.")
    .transform(unique),
  // Q13
  out_of_band_channel: z.enum(OUT_OF_BAND_CHANNELS),
  out_of_band_details: optionalShort,
  // Q14
  had_incident: z.enum(YES_NO),
  incident_type: optionalShort,
  // Q15
  review_cadence: z.enum(REVIEW_CADENCES),
  plan_approver: shortText.min(1, "Say who approves the plan."),
});

export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswersSchema>;

/**
 * Loose version used for autosave: every field is optional and nested objects may be
 * partial, so a half-finished step can be stored without losing anything already typed.
 */
export const questionnaireDraftSchema = questionnaireAnswersSchema
  .omit({ roles: true, outside_parties: true, backups: true })
  .partial()
  .extend({
    roles: z
      .object({
        it_security_lead: roleSchema.partial(),
        executive_decision_maker: roleSchema.partial(),
        legal: roleSchema.partial(),
        customer_communications: roleSchema.partial(),
      })
      .partial()
      .optional(),
    outside_parties: questionnaireAnswersSchema.shape.outside_parties.partial().optional(),
    backups: questionnaireAnswersSchema.shape.backups.partial().optional(),
  });

export type QuestionnaireDraft = z.infer<typeof questionnaireDraftSchema>;

/** Which answer keys each step owns. Step 1 also edits the organization row. */
export const STEP_FIELDS: Record<QuestionnaireStep, (keyof QuestionnaireAnswers)[]> = {
  1: ["next_audit_date"],
  2: [
    "data_types",
    "hosting",
    "identity_provider",
    "identity_provider_other",
    "mfa_status",
    "key_systems",
  ],
  3: ["roles", "outside_parties"],
  4: [
    "monitoring",
    "backups",
    "out_of_band_channel",
    "out_of_band_details",
    "had_incident",
    "incident_type",
  ],
  5: [
    "customer_notification_obligations",
    "regulatory_obligations",
    "review_cadence",
    "plan_approver",
  ],
};

/** Keys whose form controls are checkbox groups, so every checked value must be read. */
export const ARRAY_FIELDS = new Set<keyof QuestionnaireAnswers>([
  "data_types",
  "hosting",
  "monitoring",
  "regulatory_obligations",
]);

/** The schema for one step's fields, strict (used when the user moves on). */
export function stepSchema(step: QuestionnaireStep) {
  const shape: Record<string, z.ZodType> = {};
  for (const key of STEP_FIELDS[step]) shape[key] = questionnaireAnswersSchema.shape[key];
  return z.object(shape);
}

/** The same step, loose (used for autosave). */
export function stepDraftSchema(step: QuestionnaireStep) {
  const shape: Record<string, z.ZodType> = {};
  for (const key of STEP_FIELDS[step]) shape[key] = questionnaireDraftSchema.shape[key];
  return z.object(shape);
}

/** True when a step's answers would pass the strict schema. */
export function isStepComplete(step: QuestionnaireStep, answers: unknown): boolean {
  const subset: Record<string, unknown> = {};
  const source = (answers ?? {}) as Record<string, unknown>;
  for (const key of STEP_FIELDS[step]) subset[key] = source[key];
  return stepSchema(step).safeParse(subset).success;
}

export function parseStep(step: string | undefined): QuestionnaireStep {
  const n = Number(step);
  return (QUESTIONNAIRE_STEPS.some((s) => s.step === n) ? n : 1) as QuestionnaireStep;
}
