import type { Metadata } from "next";
import { ScenarioGenerator } from "@/components/generator/scenario-generator";
import { GeneratorViewTracker } from "@/components/generator/view-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Free tabletop exercise scenario generator",
  description:
    "Describe your company, pick an incident, and get a tabletop exercise scenario your team can run in about an hour.",
};

// The Server Action on this page waits for a model response, which can take a minute or more.
export const maxDuration = 120;

export default function GeneratePage() {
  return (
    <>
      <GeneratorViewTracker />
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="mb-10 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Generate a tabletop exercise scenario
          </h1>
          <p className="leading-relaxed text-muted-foreground">
            Tell us about your company and pick an incident. You get a scenario your team can run in
            about an hour: roles, a timeline of events with discussion questions, and questions for
            the debrief.
          </p>
        </div>
        <ScenarioGenerator />
      </main>
      <SiteFooter />
    </>
  );
}
