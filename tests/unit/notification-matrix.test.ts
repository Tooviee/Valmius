import { describe, expect, it } from "vitest";
import {
  buildNotificationMatrix,
  buildNotificationMatrixSection,
  matrixToMarkdown,
  type MatrixInput,
} from "@/lib/plan/notification-matrix";
import { planSectionSchema } from "@/lib/schemas/plan";

const base: MatrixInput = {
  companyName: "Alpha Clinic",
  frameworks: [],
  dataTypes: [],
  regulatoryObligations: [],
  owners: {
    legal: "COO",
    executive: "CEO",
    communications: "Head of Patient Services",
    technical: "IT Manager",
  },
};

const keys = (input: MatrixInput) => buildNotificationMatrix(input).map((row) => row.key);

describe("buildNotificationMatrix", () => {
  it("always recommends law enforcement and nothing else for a company with no obligations", () => {
    expect(keys({ ...base, regulatoryObligations: ["none_known"] })).toEqual(["law_enforcement"]);
  });

  it("maps each regulatory answer to a row with the right deadline and owner", () => {
    const rows = buildNotificationMatrix({
      ...base,
      regulatoryObligations: [
        "hipaa",
        "nydfs",
        "gdpr",
        "state_breach_laws",
        "pci_card_brands",
        "sec",
      ],
    });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.hipaa.deadline).toMatch(/60 days/);
    expect(byKey.hipaa.owner).toBe("COO");
    expect(byKey.nydfs.deadline).toMatch(/72 hours/);
    expect(byKey.gdpr.deadline).toMatch(/72 hours/);
    expect(byKey.state_breach_laws.deadline).toMatch(/Attorney General/);
    expect(byKey.pci_card_brands.owner).toBe("IT Manager");
    expect(byKey.sec.deadline).toMatch(/4 business days/);
    expect(byKey.sec.owner).toBe("CEO");
  });

  it("adds rows from the frameworks and handled data types without duplicating answered ones", () => {
    const rows = buildNotificationMatrix({
      ...base,
      frameworks: ["hipaa", "pci_dss", "nydfs_500", "cmmc_nist_800_171"],
      dataTypes: ["health_data", "payment_card_data"],
      regulatoryObligations: ["hipaa"],
    });
    expect(rows.map((row) => row.key)).toEqual([
      "hipaa",
      "pci_card_brands",
      "nydfs",
      "dfars",
      "law_enforcement",
    ]);
    const hipaa = rows.find((row) => row.key === "hipaa")!;
    expect(hipaa.source).toBe("answer");
    expect(hipaa.obligation).not.toMatch(/confirm/);
  });

  it("flags rows that come only from the data types handled", () => {
    const rows = buildNotificationMatrix({ ...base, dataTypes: ["payment_card_data"] });
    const pci = rows.find((row) => row.key === "pci_card_brands")!;
    expect(pci.source).toBe("data");
    expect(pci.obligation).toMatch(/confirm this applies/);
  });

  it("adds contractual and insurer rows from the answers", () => {
    const rows = buildNotificationMatrix({
      ...base,
      customerObligations: "Notify the hospital network within 48 hours of a confirmed breach.",
      insurerName: "Coalition",
    });
    const contract = rows.find((row) => row.key === "customer_contracts")!;
    expect(contract.deadline).toMatch(/48 hours/);
    expect(contract.owner).toBe("Head of Patient Services with COO");
    const insurer = rows.find((row) => row.key === "cyber_insurance")!;
    expect(insurer.obligation).toBe("Cyber insurance (Coalition)");
    expect(insurer.owner).toBe("CEO");
  });

  it("adds the insurer row when cyber insurance is the only framework", () => {
    expect(keys({ ...base, frameworks: ["cyber_insurance"] })).toContain("cyber_insurance");
  });
});

describe("matrix markdown", () => {
  it("renders a GFM table and escapes pipes", () => {
    const markdown = matrixToMarkdown([
      {
        key: "x",
        obligation: "A | B",
        trigger: "t",
        deadline: "d",
        owner: "o",
        source: "answer",
      },
    ]);
    expect(markdown.split("\n")).toHaveLength(3);
    expect(markdown).toContain("| A \\| B | t | d | o |");
  });

  it("builds a valid plan section with framework refs that match the rows", () => {
    const section = buildNotificationMatrixSection({
      ...base,
      regulatoryObligations: ["hipaa", "nydfs"],
      outsideCounsel: "Harbor Legal LLP",
    });
    expect(planSectionSchema.safeParse(section).success).toBe(true);
    expect(section.origin).toBe("matrix");
    expect(section.framework_refs).toEqual([
      "SOC 2 CC7.4",
      "NIST CSF ID.IM-04",
      "NYDFS 500.16",
      "HIPAA 164.308(a)(6)(ii)",
    ]);
    expect(section.markdown).toContain("Harbor Legal LLP");
    expect(section.markdown).toContain("| Obligation | Trigger | Deadline | Owner |");
  });
});
