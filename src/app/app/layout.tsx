import { AppHeader } from "@/components/app/app-header";
import { SiteFooter } from "@/components/site-footer";
import { getOrgContext, requireUser } from "@/lib/auth/session";

/** The signed-in area. src/proxy.ts has already redirected visitors without a session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const context = await getOrgContext();

  return (
    <>
      <AppHeader email={user.email} orgName={context?.org.name ?? null} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
