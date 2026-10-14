import type { PlanSection } from "@/lib/schemas/plan";
import type { FrameworkRef } from "@/lib/schemas/frameworks";

/**
 * The notification matrix (SPEC.md section 8.2, item 7), built from the answers rather
 * than by the model so that no deadline is ever invented.
 */

export type MatrixInput = {
  companyName: string;
  frameworks: readonly string[];
  dataTypes: readonly string[];
  regulatoryObligations: readonly string[];
  customerObligations?: string;
  insurerName?: string;
  outsideCounsel?: string;
  owners: { legal: string; executive: string; communications: string; technical: string };
};

export type MatrixRow = {
  key: string;
  obligation: string;
  trigger: string;
  deadline: string;
  owner: string;
  /** Why the row is here, shown as a note in the plan. */
  source: "answer" | "framework" | "data" | "contract" | "recommended";
};

type RowTemplate = Omit<MatrixRow, "owner" | "source"> & {
  owner: keyof MatrixInput["owners"];
};

const ROWS: Record<string, RowTemplate> = {
  state_breach_laws: {
    key: "state_breach_laws",
    obligation: "US state breach notification laws",
    trigger:
      "Unauthorized access to, or acquisition of, personal information of residents of a state",
    deadline:
      "Varies by state: most require notice to individuals without unreasonable delay, many within 30 to 60 days of discovery, and several require notice to the state Attorney General",
    owner: "legal",
  },
  gdpr: {
    key: "gdpr",
    obligation: "GDPR (Articles 33 and 34)",
    trigger: "A personal data breach involving EU or UK residents",
    deadline:
      "72 hours to the supervisory authority after becoming aware; affected individuals without undue delay when the risk to them is high",
    owner: "legal",
  },
  hipaa: {
    key: "hipaa",
    obligation: "HIPAA Breach Notification Rule",
    trigger: "A breach of unsecured protected health information (PHI)",
    deadline:
      "Individuals and HHS within 60 days of discovery (HHS within 60 days of year end if fewer than 500 people); prominent media if more than 500 residents of a state",
    owner: "legal",
  },
  pci_card_brands: {
    key: "pci_card_brands",
    obligation: "PCI DSS 12.10.1 and card brand rules",
    trigger: "Suspected or confirmed compromise of cardholder data or the systems that touch it",
    deadline:
      "Immediately, through the acquiring bank; card brands typically expect notice within 24 to 72 hours",
    owner: "technical",
  },
  nydfs: {
    key: "nydfs",
    obligation: "NYDFS 23 NYCRR 500.17",
    trigger:
      "A cybersecurity incident with a reasonable likelihood of material harm, or any extortion payment",
    deadline:
      "72 hours from determining the incident occurred; an extortion payment within 24 hours, with a written explanation within 30 days",
    owner: "legal",
  },
  sec: {
    key: "sec",
    obligation: "SEC Form 8-K, Item 1.05",
    trigger: "A cybersecurity incident determined to be material",
    deadline: "4 business days after the materiality determination",
    owner: "executive",
  },
  dfars: {
    key: "dfars",
    obligation: "DFARS 252.204-7012 (CMMC / NIST 800-171)",
    trigger: "A cyber incident affecting covered defense information or a system that processes it",
    deadline:
      "72 hours to the Department of Defense through DIBNet, with a 90-day media preservation duty",
    owner: "legal",
  },
};

const FRAMEWORK_ROWS: Record<string, string> = {
  hipaa: "hipaa",
  pci_dss: "pci_card_brands",
  nydfs_500: "nydfs",
  cmmc_nist_800_171: "dfars",
};

const DATA_ROWS: Record<string, string> = {
  health_data: "hipaa",
  payment_card_data: "pci_card_brands",
};

function withOwner(template: RowTemplate, input: MatrixInput, source: MatrixRow["source"]) {
  return { ...template, owner: input.owners[template.owner], source };
}

/** Builds the matrix rows. Deterministic: the same answers always give the same rows. */
export function buildNotificationMatrix(input: MatrixInput): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  const add = (key: string, source: MatrixRow["source"]) => {
    const template = ROWS[key];
    if (template && !rows.has(key)) rows.set(key, withOwner(template, input, source));
  };

  for (const obligation of input.regulatoryObligations) add(obligation, "answer");
  for (const framework of input.frameworks) {
    const key = FRAMEWORK_ROWS[framework];
    if (key) add(key, "framework");
  }
  for (const dataType of input.dataTypes) {
    const key = DATA_ROWS[dataType];
    if (key) {
      add(key, "data");
      const row = rows.get(key)!;
      if (row.source === "data") {
        rows.set(key, { ...row, obligation: `${row.obligation} (confirm this applies to you)` });
      }
    }
  }

  const customer = input.customerObligations?.trim();
  if (customer) {
    rows.set("customer_contracts", {
      key: "customer_contracts",
      obligation: "Customer contracts",
      trigger:
        "A confirmed incident affecting a customer's data or service, as the contract defines it",
      deadline: customer.length > 300 ? `${customer.slice(0, 297)}...` : customer,
      owner: `${input.owners.communications} with ${input.owners.legal}`,
      source: "contract",
    });
  }

  if (input.insurerName || input.frameworks.includes("cyber_insurance")) {
    rows.set("cyber_insurance", {
      key: "cyber_insurance",
      obligation: input.insurerName
        ? `Cyber insurance (${input.insurerName})`
        : "Cyber insurance policy",
      trigger: "Any suspected incident that could lead to a claim, before engaging outside help",
      deadline:
        "As soon as possible: many policies require notice within 24 to 72 hours and the use of the insurer's panel counsel and forensics firm",
      owner: input.owners.executive,
      source: "recommended",
    });
  }

  rows.set("law_enforcement", {
    key: "law_enforcement",
    obligation: "Law enforcement (FBI IC3, local police)",
    trigger: "Ransomware, extortion, business email compromise or wire fraud",
    deadline:
      "No legal deadline; report the same day. A fraudulent wire can only be recalled within hours",
    owner: input.owners.executive,
    source: "recommended",
  });

  return [...rows.values()];
}

const escapeCell = (text: string) => text.replaceAll("|", "\\|").replaceAll(/\s*\n\s*/g, " ");

/** Renders rows as a GitHub-flavored markdown table. */
export function matrixToMarkdown(rows: MatrixRow[]): string {
  const lines = [
    "| Obligation | Trigger | Deadline | Owner |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${escapeCell(row.obligation)} | ${escapeCell(row.trigger)} | ${escapeCell(row.deadline)} | ${escapeCell(row.owner)} |`,
    ),
  ];
  return lines.join("\n");
}

/** The complete notification matrix section, ready to store as a plan section. */
export function buildNotificationMatrixSection(input: MatrixInput): PlanSection {
  const rows = buildNotificationMatrix(input);
  const counsel = input.outsideCounsel?.trim() || "[outside counsel: fill in]";
  const refs: FrameworkRef[] = ["SOC 2 CC7.4", "NIST CSF ID.IM-04"];
  if (rows.some((row) => row.key === "pci_card_brands")) refs.push("PCI DSS 12.10.1");
  if (rows.some((row) => row.key === "nydfs")) refs.push("NYDFS 500.16");
  if (rows.some((row) => row.key === "hipaa")) refs.push("HIPAA 164.308(a)(6)(ii)");
  if (rows.some((row) => row.key === "dfars")) refs.push("NIST 800-171 3.6.2");

  const markdown = [
    `This table lists every notification duty we know of for ${input.companyName}. Each clock starts at the moment described in the Trigger column, so the first job in any incident is to write that moment in the decision log.`,
    "",
    matrixToMarkdown(rows),
    "",
    "### How to use this table",
    "",
    `- When an incident is declared, the Legal and Compliance Lead (${input.owners.legal}) copies this table into the incident channel and marks each row as applies, does not apply, or unsure.`,
    `- Unsure rows go to ${counsel} the same day. Deadlines are as we understand the law or contract; confirm with counsel before relying on one.`,
    "- Rows marked as recommended carry no legal deadline but protect the company: insurers can deny a claim for late notice, and a fraudulent wire can only be recalled within hours.",
    "- When a deadline is met, record who notified whom, when, and how, in the decision log, and keep a copy of what was sent.",
  ].join("\n");

  return {
    id: "notification_matrix",
    title: "Notification matrix",
    markdown,
    framework_refs: refs,
    origin: "matrix",
  };
}
