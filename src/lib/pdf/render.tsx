import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Scenario } from "@/lib/schemas/scenario";
import { ScenarioDocument } from "./scenario-document";

/** Renders the gated PDF: the full scenario plus a blank after-action report template. */
export async function renderScenarioPdf(
  scenario: Scenario,
  now: Date = new Date(),
): Promise<Buffer> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return renderToBuffer(
    <ScenarioDocument
      scenario={scenario}
      generatedOn={now.toISOString().slice(0, 10)}
      siteUrl={siteUrl.replace(/^https?:\/\//, "")}
    />,
  );
}

export function scenarioPdfFilename(scenario: Scenario): string {
  return `valmius-${scenario.type.replaceAll("_", "-")}-scenario.pdf`;
}
