import {
  HOSTING_LABELS,
  INDUSTRY_LABELS,
  type HostingOption,
  type Industry,
} from "@/lib/schemas/generator";
import { FRAMEWORK_LABELS, type Framework } from "@/lib/schemas/organization";
import {
  DATA_TYPE_LABELS,
  IDENTITY_PROVIDER_LABELS,
  MFA_STATUS_LABELS,
  MONITORING_LABELS,
  OUT_OF_BAND_LABELS,
  REGULATORY_OBLIGATION_LABELS,
  REVIEW_CADENCE_LABELS,
  type QuestionnaireAnswers,
} from "@/lib/schemas/questionnaire";
import type { Tables } from "@/lib/supabase/database.types";
import { buildNotificationMatrix, type MatrixInput, type MatrixRow } from "./notification-matrix";

/**
 * Everything the plan is written from, derived once from the organization and the
 * questionnaire. Every section call gets the same facts, which is what keeps roles,
 * systems and deadlines consistent across sections written independently.
 */

export const PLAN_ROLE_NAMES = [
  "Incident Commander",
  "Technical Lead",
  "Communications Lead",
  "Legal and Compliance Lead",
  "Executive Sponsor",
  "Scribe",
] as const;
export type PlanRoleName = (typeof PLAN_ROLE_NAMES)[number];

export type PlanRole = {
  role: PlanRoleName;
  /** The job title (or person) who holds the role. */
  holder: string;
  backup: string;
  /** Short statement of what the role does; the same for every company. */
  duty: string;
};

export type SeverityLevel = {
  level: "SEV1" | "SEV2" | "SEV3";
  name: string;
  definition: string;
  response: string;
};

export const SEVERITY_LEVELS: SeverityLevel[] = [
  {
    level: "SEV1",
    name: "Critical",
    definition:
      "Confirmed or likely compromise with active harm: ransomware encryption, an attacker inside the identity provider or a cloud account, confirmed theft of regulated data, or payment fraud in progress.",
    response:
      "Response starts within 15 minutes at any hour; the Executive Sponsor is told within 1 hour; the notification matrix is reviewed the same day.",
  },
  {
    level: "SEV2",
    name: "Serious",
    definition:
      "Contained or single-system compromise with no confirmed data loss: one mailbox taken over, malware on one laptop caught by the endpoint tool, a lost device that was not encrypted.",
    response:
      "Response starts within 1 hour during business hours; the Executive Sponsor gets a same-day update.",
  },
  {
    level: "SEV3",
    name: "Suspicious",
    definition:
      "Suspicious activity with no confirmed compromise: a reported phishing email nobody acted on, a spike in failed logins, a vendor security advisory.",
    response: "Reviewed within 1 business day; closed or escalated in writing.",
  },
];

export type PlanFacts = {
  company: {
    name: string;
    industry: string;
    headcount: string;
    timezone: string;
    frameworks: string[];
    nextAuditDate?: string;
  };
  systems: {
    hosting: string[];
    dataTypes: string[];
    identityProvider: string;
    mfa: string;
    keySystems: string;
  };
  roles: PlanRole[];
  outsideParties: {
    msp?: string;
    outsideCounsel?: string;
    insurer?: string;
    insurerPhone?: string;
    forensicsRetainer: boolean;
  };
  monitoring: string[];
  backups: { location: string; frequency: string; lastRestoreTest: string };
  obligations: { customer?: string; regulatory: string[] };
  outOfBand: { channel: string; details?: string };
  incidents: { hadIncident: boolean; type?: string };
  review: { cadence: string; cadenceMonths: 12 | 6 | 3; approver: string };
  severity: SeverityLevel[];
  matrix: MatrixRow[];
  /** The inputs the matrix was built from, so the section can be rebuilt on demand. */
  matrixInput: MatrixInput;
};

const CADENCE_MONTHS = { annual: 12, semi_annual: 6, quarterly: 3 } as const;

const holderOf = (role: { title: string; name?: string }) =>
  role.name?.trim() ? `${role.name.trim()} (${role.title})` : role.title;

const orFill = (value: string | undefined, fallback = "[fill in]") =>
  value?.trim() ? value.trim() : fallback;

function buildRoles(answers: QuestionnaireAnswers): PlanRole[] {
  const { it_security_lead, executive_decision_maker, legal, customer_communications } =
    answers.roles;
  const itBackup = it_security_lead.backup?.trim();
  return [
    {
      role: "Incident Commander",
      holder: holderOf(it_security_lead),
      backup: orFill(itBackup, holderOf(executive_decision_maker)),
      duty: "Declares the incident and its severity, runs the response, makes the calls nobody else can, and ends the incident.",
    },
    {
      role: "Technical Lead",
      holder: itBackup
        ? itBackup
        : `${holderOf(it_security_lead)} (same person as the Incident Commander until a second technical person is named)`,
      backup: itBackup
        ? holderOf(it_security_lead)
        : orFill(answers.outside_parties.msp, "[MSP or contractor: fill in]"),
      duty: "Investigates, contains and recovers systems, and keeps the technical timeline.",
    },
    {
      role: "Communications Lead",
      holder: holderOf(customer_communications),
      backup: orFill(customer_communications.backup, holderOf(executive_decision_maker)),
      duty: "Owns every message to staff, customers, partners and the press, and keeps one approved version of each.",
    },
    {
      role: "Legal and Compliance Lead",
      holder: holderOf(legal),
      backup: orFill(
        legal.backup,
        orFill(answers.outside_parties.outside_counsel, "[outside counsel: fill in]"),
      ),
      duty: "Works the notification matrix, calls the insurer and outside counsel, and decides what must be reported and when.",
    },
    {
      role: "Executive Sponsor",
      holder: holderOf(executive_decision_maker),
      backup: orFill(executive_decision_maker.backup),
      duty: "Approves spending, ransom and shutdown decisions, and speaks for the company to the board and regulators.",
    },
    {
      role: "Scribe",
      holder:
        "Assigned by the Incident Commander at the start of each incident (any available team member)",
      backup: "The Communications Lead",
      duty: "Keeps the decision log: every decision, who made it, and the time, as it happens.",
    },
  ];
}

export function buildPlanFacts(
  org: Pick<
    Tables<"organizations">,
    "name" | "industry" | "headcount_band" | "timezone" | "frameworks"
  >,
  answers: QuestionnaireAnswers,
): PlanFacts {
  const roles = buildRoles(answers);
  const matrixInput: MatrixInput = {
    companyName: org.name,
    frameworks: org.frameworks,
    dataTypes: answers.data_types,
    regulatoryObligations: answers.regulatory_obligations,
    customerObligations: answers.customer_notification_obligations,
    insurerName: answers.outside_parties.insurer_name,
    outsideCounsel: answers.outside_parties.outside_counsel,
    owners: {
      legal: answers.roles.legal.title,
      executive: answers.roles.executive_decision_maker.title,
      communications: answers.roles.customer_communications.title,
      technical: answers.roles.it_security_lead.title,
    },
  };

  return {
    company: {
      name: org.name,
      industry: INDUSTRY_LABELS[org.industry as Industry] ?? org.industry,
      headcount: `${org.headcount_band} employees`,
      timezone: org.timezone,
      frameworks: org.frameworks.map((f) => FRAMEWORK_LABELS[f as Framework] ?? f),
      nextAuditDate: answers.next_audit_date,
    },
    systems: {
      hosting: answers.hosting.map((h) => HOSTING_LABELS[h as HostingOption] ?? h),
      dataTypes: answers.data_types.map((d) => DATA_TYPE_LABELS[d]),
      identityProvider:
        answers.identity_provider === "other"
          ? orFill(answers.identity_provider_other, "Other identity provider")
          : IDENTITY_PROVIDER_LABELS[answers.identity_provider],
      mfa: MFA_STATUS_LABELS[answers.mfa_status],
      keySystems: answers.key_systems,
    },
    roles,
    outsideParties: {
      msp: answers.outside_parties.msp?.trim() || undefined,
      outsideCounsel: answers.outside_parties.outside_counsel?.trim() || undefined,
      insurer: answers.outside_parties.insurer_name?.trim() || undefined,
      insurerPhone: answers.outside_parties.insurer_claims_phone?.trim() || undefined,
      forensicsRetainer: answers.outside_parties.forensics_retainer === "yes",
    },
    monitoring: answers.monitoring.map((m) => MONITORING_LABELS[m]),
    backups: {
      location: answers.backups.location,
      frequency: answers.backups.frequency,
      lastRestoreTest: answers.backups.last_restore_test,
    },
    obligations: {
      customer: answers.customer_notification_obligations?.trim() || undefined,
      regulatory: answers.regulatory_obligations.map((r) => REGULATORY_OBLIGATION_LABELS[r]),
    },
    outOfBand: {
      channel: OUT_OF_BAND_LABELS[answers.out_of_band_channel],
      details: answers.out_of_band_details?.trim() || undefined,
    },
    incidents: {
      hadIncident: answers.had_incident === "yes",
      type: answers.incident_type?.trim() || undefined,
    },
    review: {
      cadence: REVIEW_CADENCE_LABELS[answers.review_cadence],
      cadenceMonths: CADENCE_MONTHS[answers.review_cadence],
      approver: answers.plan_approver,
    },
    severity: SEVERITY_LEVELS,
    matrix: buildNotificationMatrix(matrixInput),
    matrixInput,
  };
}

const escapeCell = (text: string) => text.replaceAll("|", "\\|");

/** The roles as a markdown table, used verbatim in section 2 and the prompts. */
export function rolesTableMarkdown(facts: PlanFacts): string {
  return [
    "| Role | Who | Backup | Responsibility |",
    "| --- | --- | --- | --- |",
    ...facts.roles.map(
      (r) =>
        `| ${r.role} | ${escapeCell(r.holder)} | ${escapeCell(r.backup)} | ${escapeCell(r.duty)} |`,
    ),
  ].join("\n");
}

const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "none");

/** The facts as plain text for the model. Every answer appears here, labelled. */
export function factsToPromptText(facts: PlanFacts): string {
  const { company, systems, outsideParties, backups, obligations, outOfBand, incidents, review } =
    facts;
  return [
    `Company: ${company.name}, ${company.industry}, ${company.headcount}. Time zone ${company.timezone}.`,
    `Compliance obligations: ${list(company.frameworks)}.${company.nextAuditDate ? ` Next audit or renewal: ${company.nextAuditDate}.` : ""}`,
    `Sensitive data handled: ${list(systems.dataTypes)}.`,
    `Where systems run: ${list(systems.hosting)}.`,
    `Identity provider: ${systems.identityProvider}. MFA enforced: ${systems.mfa}.`,
    `Key business systems (in the company's own words): ${systems.keySystems}`,
    "",
    "Incident roles (use these titles exactly):",
    ...facts.roles.map((r) => `- ${r.role}: ${r.holder}; backup: ${r.backup}.`),
    "",
    `Outside parties: MSP ${outsideParties.msp ?? "none"}; outside counsel ${outsideParties.outsideCounsel ?? "none named"}; cyber insurer ${outsideParties.insurer ?? "none named"}${outsideParties.insurerPhone ? ` (claims line on file)` : ""}; forensics retainer: ${outsideParties.forensicsRetainer ? "yes" : "no"}.`,
    `Monitoring in place: ${list(facts.monitoring)}.`,
    `Backups: kept in ${backups.location}; run ${backups.frequency}; last successful restore test: ${backups.lastRestoreTest}.`,
    `Customer contractual notification obligations: ${obligations.customer ?? "none known"}.`,
    `Regulatory notification obligations: ${list(obligations.regulatory)}.`,
    `Out-of-band channel if email and chat are compromised: ${outOfBand.channel}${outOfBand.details ? ` (${outOfBand.details})` : ""}.`,
    `Incidents in the last 24 months: ${incidents.hadIncident ? `yes${incidents.type ? `: ${incidents.type}` : ""}` : "none"}.`,
    `Plan review cadence: ${review.cadence}. Plan approver: ${review.approver}.`,
    "",
    "Severity levels (use these definitions):",
    ...facts.severity.map((s) => `- ${s.level} (${s.name}): ${s.definition} ${s.response}`),
    "",
    "Notification obligations already worked out (do not restate deadlines beyond these):",
    ...facts.matrix.map(
      (row) =>
        `- ${row.obligation}: trigger ${row.trigger}; deadline ${row.deadline}; owner ${row.owner}.`,
    ),
  ].join("\n");
}
