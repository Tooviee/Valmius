import { z } from "zod";
import { FRAMEWORK_REFS } from "./frameworks";

/** The 11 sections of an IR plan (SPEC.md section 8.2), in order. */
export const PLAN_SECTIONS = [
  {
    id: "purpose",
    title: "Purpose, scope and authority",
    outline: "Purpose, scope, authority, plan owner, version history.",
  },
  {
    id: "roles",
    title: "Roles and responsibilities",
    outline:
      "Incident Commander, Technical Lead, Communications Lead, Legal and Compliance Lead, Executive Sponsor, Scribe, each with a named backup.",
  },
  {
    id: "severity",
    title: "Incident definitions and severity levels",
    outline:
      "What counts as an incident; SEV1 to SEV3 with concrete examples for this company's stack.",
  },
  {
    id: "detection",
    title: "Detection and reporting",
    outline: "How employees report, the intake channel, triage steps, who decides severity.",
  },
  {
    id: "lifecycle",
    title: "Response lifecycle",
    outline:
      "Aligned to NIST SP 800-61 Rev. 3 and CSF 2.0: Preparation, Detection and Analysis, Containment, Eradication and Recovery, Post-incident activity. Written for this company's systems.",
  },
  {
    id: "communication",
    title: "Communication plan",
    outline:
      "Internal, customers, regulators, law enforcement, insurer, media; the out-of-band channel; holding-statement templates.",
  },
  {
    id: "notification_matrix",
    title: "Notification matrix",
    outline: "Each notification obligation with its trigger, deadline and owner.",
  },
  {
    id: "evidence",
    title: "Evidence handling and documentation",
    outline:
      "Decision log, chain of custody basics, what not to do (do not wipe, do not pay without counsel and insurer).",
  },
  {
    id: "playbooks",
    title: "Scenario playbooks",
    outline:
      "Short runbooks for ransomware, business email compromise, cloud credential compromise and vendor breach.",
  },
  {
    id: "testing",
    title: "Testing and maintenance",
    outline:
      "Annual tabletop at minimum (more often if chosen), review triggers (major system change, incident, audit finding), approval procedure.",
  },
  {
    id: "appendices",
    title: "Appendices",
    outline: "Contact list, system inventory, control mapping.",
  },
] as const;

export const PLAN_SECTION_IDS = [
  "purpose",
  "roles",
  "severity",
  "detection",
  "lifecycle",
  "communication",
  "notification_matrix",
  "evidence",
  "playbooks",
  "testing",
  "appendices",
] as const satisfies readonly (typeof PLAN_SECTIONS)[number]["id"][];

export type PlanSectionId = (typeof PLAN_SECTION_IDS)[number];
export const planSectionIdSchema = z.enum(PLAN_SECTION_IDS);

/** Sections the model writes. The notification matrix is built in code from the answers. */
export const MODEL_SECTION_IDS = PLAN_SECTION_IDS.filter(
  (id) => id !== "notification_matrix",
) as Exclude<PlanSectionId, "notification_matrix">[];

export function planSectionMeta(id: PlanSectionId) {
  return PLAN_SECTIONS.find((section) => section.id === id)!;
}

export const SECTION_MARKDOWN_MAX_LENGTH = 20_000;

/** Where a section's text came from. "template" sections are flagged for review in the UI. */
export const SECTION_ORIGINS = ["model", "matrix", "template", "user"] as const;
export type SectionOrigin = (typeof SECTION_ORIGINS)[number];

/** What the model returns for one section (SPEC.md section 7: title, markdown, framework_refs). */
export const planSectionOutputSchema = z.object({
  markdown: z.string().trim().min(200).max(SECTION_MARKDOWN_MAX_LENGTH),
  framework_refs: z
    .array(z.enum(FRAMEWORK_REFS))
    .max(8)
    .transform((refs) => [...new Set(refs)]),
});
export type PlanSectionOutput = z.infer<typeof planSectionOutputSchema>;

export const planSectionSchema = z.object({
  id: planSectionIdSchema,
  title: z.string().trim().min(1).max(200),
  markdown: z.string().trim().min(1).max(SECTION_MARKDOWN_MAX_LENGTH),
  framework_refs: z.array(z.enum(FRAMEWORK_REFS)).max(16),
  origin: z.enum(SECTION_ORIGINS).default("user"),
});
export type PlanSection = z.infer<typeof planSectionSchema>;

/** The stored `ir_plans.sections` value: exactly the 11 sections, in outline order. */
export const planSectionsSchema = z
  .array(planSectionSchema)
  .length(PLAN_SECTION_IDS.length)
  .refine(
    (sections) => sections.every((section, index) => section.id === PLAN_SECTION_IDS[index]),
    { message: "sections must be the 11 outline sections in order" },
  );
export type PlanSections = z.infer<typeof planSectionsSchema>;
