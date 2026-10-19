import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSessionUser()) redirect("/app");
  const { error } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Valmius</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enter your work email and we will send you a link that signs you in.
          </p>
        </div>
        <LoginForm linkError={error === "link" || error === "device" ? error : null} />
      </main>
      <SiteFooter />
    </>
  );
}
