/**
 * The control IDs Drill Day evidences directly (SPEC.md section 9.1, "Covered directly").
 * Scenario content may reference these and nothing broader.
 */
export const FRAMEWORK_REFS = [
  "SOC 2 CC7.3",
  "SOC 2 CC7.4",
  "SOC 2 CC7.5",
  "PCI DSS 12.10.1",
  "PCI DSS 12.10.2",
  "PCI DSS 12.10.6",
  "ISO 27001 A.5.24",
  "ISO 27001 A.5.26",
  "ISO 27001 A.5.27",
  "NIST CSF ID.IM-02",
  "NIST CSF ID.IM-04",
  "HIPAA 164.308(a)(6)(ii)",
  "NIST 800-171 3.6.1",
  "NIST 800-171 3.6.2",
  "NIST 800-171 3.6.3",
  "NYDFS 500.16",
] as const;

export type FrameworkRef = (typeof FRAMEWORK_REFS)[number];

/** What each control asks for, in plain words. Used in prompts and in the PDF control mapping. */
export const FRAMEWORK_REF_SUMMARIES: Record<FrameworkRef, string> = {
  "SOC 2 CC7.3": "Security events are evaluated to decide whether they are incidents",
  "SOC 2 CC7.4": "Identified incidents are handled through a defined response program",
  "SOC 2 CC7.5": "Activities to recover from identified incidents are carried out",
  "PCI DSS 12.10.1": "An incident response plan exists and is ready to be activated",
  "PCI DSS 12.10.2": "The incident response plan is reviewed and tested at least every 12 months",
  "PCI DSS 12.10.6": "The plan is updated according to lessons learned",
  "ISO 27001 A.5.24": "Incident management is planned and prepared for",
  "ISO 27001 A.5.26": "Incidents are responded to according to documented procedures",
  "ISO 27001 A.5.27": "Knowledge gained from incidents is used to strengthen controls",
  "NIST CSF ID.IM-02": "Improvements are identified from security tests and exercises",
  "NIST CSF ID.IM-04": "Incident response plans are established, maintained and improved",
  "HIPAA 164.308(a)(6)(ii)":
    "Security incidents are identified, responded to and documented with their outcomes",
  "NIST 800-171 3.6.1": "An operational incident-handling capability is established",
  "NIST 800-171 3.6.2": "Incidents are tracked, documented and reported",
  "NIST 800-171 3.6.3": "The incident response capability is tested",
  "NYDFS 500.16": "A written incident response plan is maintained and tested",
};
