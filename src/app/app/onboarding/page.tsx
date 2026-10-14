import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { getOrgContext, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Set up your organization",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  await requireUser();
  if (await getOrgContext()) redirect("/app");

  const timeZones = [...Intl.supportedValuesOf("timeZone"), "UTC"].sort();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Tell us about your company
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          This sets up the organization your plan, exercises and reports belong to. It takes a
          minute; the questionnaire for the plan itself comes next.
        </p>
      </div>
      <OnboardingForm timeZones={timeZones} />
    </div>
  );
}
