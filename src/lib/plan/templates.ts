import { planSectionMeta, type PlanSection, type PlanSectionId } from "@/lib/schemas/plan";
import { rolesTableMarkdown, type PlanFacts } from "./facts";

/**
 * Plain fallback text for a section when the model cannot be reached or keeps returning
 * invalid output. Built only from the facts, so nothing in it is invented; the plan page
 * flags these sections for the founder to regenerate or rewrite.
 */

const NOTE =
  "> This section was filled from a template because the generator was unavailable. Regenerate it or edit it before approving the plan.\n\n";

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

const TEMPLATES: Record<
  Exclude<PlanSectionId, "notification_matrix">,
  (facts: PlanFacts) => string
> = {
  purpose: (f) =>
    `This plan says how ${f.company.name} (${f.company.industry}, ${f.company.headcount}) detects, responds to and recovers from security incidents, and who is allowed to make which decisions while one is happening.\n\n### Scope\n\nIt covers every system the company relies on, including ${f.systems.keySystems}, the accounts in ${f.systems.identityProvider}, and systems run for the company by outside parties${f.outsideParties.msp ? ` such as ${f.outsideParties.msp}` : ""}.\n\n### Authority\n\nThe Incident Commander (${f.roles[0].holder}) may take any system offline, revoke any account and engage outside help without further approval. Spending beyond pre-agreed limits, ransom decisions and public statements need the Executive Sponsor (${f.roles[4].holder}).\n\n### Plan owner and versions\n\nThe plan is owned by ${f.roles[0].holder} and approved by ${f.review.approver}. It is reviewed ${f.review.cadence.toLowerCase()} and after every incident, test or audit finding. Each approved version is kept with its approval date.`,
  roles: (f) =>
    `Everyone below should know they hold the role before an incident starts. Backups act with full authority when the primary cannot be reached within 30 minutes.\n\n${rolesTableMarkdown(f)}\n\n### Handover\n\nWhen a backup takes over, they say so in the incident channel and the Scribe records the time.`,
  severity: (f) =>
    `An incident is any event that puts the confidentiality, integrity or availability of the company's data or systems at risk, including events at outside parties that hold company data.\n\n${f.severity
      .map((s) => `### ${s.level}: ${s.name}\n\n${s.definition}\n\n${s.response}`)
      .join(
        "\n\n",
      )}\n\nThe Incident Commander sets the level when declaring the incident and may change it as facts emerge. The decision log records every change.`,
  detection: (f) =>
    `### How anyone reports a concern\n\nAny employee or contractor who sees something odd tells ${f.roles[0].holder} straight away, by phone or in person if email may be affected. Nobody is blamed for reporting something that turns out to be nothing.\n\n### Where alerts arrive\n\n${bullets(f.monitoring.map((m) => `${m}: reviewed by the Technical Lead.`))}\n\n### Triage\n\n${bullets(
      [
        "Write down what was seen, where, and when (the first entry in the decision log).",
        "Decide within 30 minutes whether this is SEV1, SEV2 or SEV3, using the definitions in the previous section.",
        "For SEV1 and SEV2, open the incident channel and call the roles in; for SEV3, assign one person to review within a business day.",
      ],
    )}`,
  lifecycle: (f) =>
    `This section follows the NIST SP 800-61 Rev. 3 lifecycle.\n\n### Preparation\n\n${bullets([
      `Keep the contact list in the appendix current and stored outside ${f.systems.identityProvider}.`,
      `Confirm ${f.systems.mfa === "Yes, enforced for everyone" ? "MFA stays enforced for everyone" : "MFA is enforced for every account, starting with administrators and finance"}.`,
      `Test a restore from ${f.backups.location} (last test: ${f.backups.lastRestoreTest}).`,
    ])}\n\n### Detection and analysis\n\nConfirm the signal, decide the severity, and establish what is affected: which accounts, which of ${f.systems.keySystems}, and what data.\n\n### Containment\n\nIsolate affected devices, disable or reset affected accounts in ${f.systems.identityProvider}, revoke exposed keys, and block the attacker's access before cleaning up. Preserve evidence first (see Evidence handling).\n\n### Eradication and recovery\n\nRemove the cause, rebuild rather than clean where practical, restore from ${f.backups.location}, and verify systems before returning them to use.\n\n### Post-incident activity\n\nWithin two weeks, hold a review, write up the timeline from the decision log, and turn gaps into action items with owners and dates.`,
  communication: (f) =>
    `### Channels\n\nThe incident channel is ${f.outOfBand.channel}${f.outOfBand.details ? ` (${f.outOfBand.details})` : ""} when email or chat may be compromised; otherwise a dedicated chat channel named for the incident.\n\n### Who speaks to whom\n\n${bullets(
      [
        `Staff: ${f.roles[2].holder}, with a short note on what to do and not do.`,
        `Customers and partners: ${f.roles[2].holder}, after review by ${f.roles[3].holder}.`,
        `Regulators and insurer: ${f.roles[3].holder}, using the notification matrix.`,
        `Law enforcement and the press: ${f.roles[4].holder}. Nobody else speaks to the press.`,
      ],
    )}\n\n### Holding statement\n\n"We are aware of a security issue affecting some of our systems. We have engaged specialists, are working to understand what happened, and will share more as soon as we can. If you have questions, contact [name and address]."`,
  evidence: () =>
    `### Decision log\n\nThe Scribe records every decision, who made it, and the time, as it is made. The log is the record the company relies on afterwards with the insurer, regulators and auditors.\n\n### Preserving evidence\n\n${bullets(
      [
        "Do not wipe, reimage or power off affected machines until the Technical Lead says so; isolate them from the network instead.",
        "Export logs from the identity provider, cloud consoles and email before they age out, and record who exported what and when.",
        "Keep copies of phishing emails with full headers, ransom notes and screenshots in a folder only the response team can reach.",
      ],
    )}\n\n### What not to do\n\n${bullets([
      "Do not pay a ransom or contact an attacker without the Executive Sponsor, counsel and the insurer agreeing.",
      "Do not email affected customers before the notification matrix has been reviewed.",
      "Do not discuss the incident on social media or with the press.",
    ])}`,
  playbooks: (f) =>
    `Each playbook lists the first hour. The full lifecycle still applies.\n\n### Ransomware\n\n${bullets(
      [
        "Isolate affected machines from the network; do not power off.",
        `Check ${f.backups.location} is intact and offline from the affected network.`,
        "Call the insurer before any contact with the attacker.",
      ],
    )}\n\n### Business email compromise\n\n${bullets([
      "Stop any payment in progress and call the bank to recall any sent wire.",
      `Reset the affected account in ${f.systems.identityProvider}, sign out all sessions, and remove forwarding rules.`,
      "Check who else received similar requests.",
    ])}\n\n### Cloud credential compromise\n\n${bullets([
      "Disable the exposed key or account first, then look for what it created or read.",
      "Review billing and audit logs for the past 30 days.",
      "Rotate every secret stored alongside the exposed one.",
    ])}\n\n### Vendor breach\n\n${bullets([
      "Get the vendor's written notice and ask what data of ours was affected.",
      "Start the clock on contractual and regulatory notifications from the moment of their notice.",
      "Reset any credentials shared with the vendor.",
    ])}`,
  testing: (f) =>
    `### Testing\n\nThe plan is exercised with a tabletop at least once a year, and ${f.review.cadence.toLowerCase()} per the company's chosen cadence. Each exercise produces a dated after-action report kept with the plan.\n\n### Review triggers\n\n${bullets(
      [
        "A real incident.",
        "A major change to systems, hosting or the identity provider.",
        "An audit finding or a change in compliance obligations.",
        f.company.nextAuditDate
          ? `At least 60 days before the next audit or renewal (${f.company.nextAuditDate}).`
          : "At least 60 days before any audit or insurance renewal.",
      ],
    )}\n\n### Approval\n\n${f.review.approver} approves each version by name and date. The previous version is kept for the record.`,
  appendices: (f) =>
    `### Contact list\n\n| Role | Who | Phone | Email |\n| --- | --- | --- | --- |\n${f.roles.map((r) => `| ${r.role} | ${r.holder} | [fill in] | [fill in] |`).join("\n")}\n| MSP | ${f.outsideParties.msp ?? "[fill in]"} | [fill in] | [fill in] |\n| Outside counsel | ${f.outsideParties.outsideCounsel ?? "[fill in]"} | [fill in] | [fill in] |\n| Cyber insurer | ${f.outsideParties.insurer ?? "[fill in]"} | ${f.outsideParties.insurerPhone ?? "[fill in]"} | [fill in] |\n\n### System inventory\n\n${bullets(
      [
        `Hosting: ${f.systems.hosting.join(", ")}.`,
        `Identity: ${f.systems.identityProvider}.`,
        `Key systems: ${f.systems.keySystems}`,
        `Backups: ${f.backups.location}, ${f.backups.frequency}.`,
      ],
    )}\n\n### Control mapping\n\nThis plan and its tests give evidence toward the incident response controls of ${f.company.frameworks.length > 0 ? f.company.frameworks.join(", ") : "the frameworks the company adopts"}; the exact control references are listed with each section.`,
};

export function templateSection(
  id: Exclude<PlanSectionId, "notification_matrix">,
  facts: PlanFacts,
): PlanSection {
  return {
    id,
    title: planSectionMeta(id).title,
    markdown: NOTE + TEMPLATES[id](facts),
    framework_refs: ["SOC 2 CC7.4", "NIST CSF ID.IM-04"],
    origin: "template",
  };
}
