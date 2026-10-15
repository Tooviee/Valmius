import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportDocument, type ReportPdfInput } from "./report-document";

export async function renderReportPdf(input: ReportPdfInput): Promise<Buffer> {
  return renderToBuffer(<ReportDocument input={input} />);
}

export function reportPdfFilename(orgName: string, exerciseTitle: string, version: number): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "report";
  return `${slug(orgName)}-${slug(exerciseTitle)}-after-action-v${version}.pdf`;
}
