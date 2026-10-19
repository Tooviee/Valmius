import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { getOrgContext, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader
        className="mb-10"
        title="Tell us about your company"
        description="This sets up the organization your plan, exercises and reports belong to. It takes a minute; the questionnaire for the plan itself comes next."
      />
      <OnboardingForm timeZones={timeZones} />
    </div>
  );
}
