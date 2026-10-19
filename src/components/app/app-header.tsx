import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/questionnaire", label: "Questionnaire" },
  { href: "/app/plan", label: "IR plan" },
  { href: "/app/exercises", label: "Exercises" },
  { href: "/app/evidence", label: "Evidence" },
] as const;

/** The signed-in shell's header: brand, app navigation (once an org exists) and sign-out. */
export function AppHeader({ email, orgName }: { email: string | null; orgName: string | null }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <div className="flex items-center gap-6">
          <Wordmark href="/app" />
          {orgName && (
            <nav aria-label="App" className="hidden items-center gap-4 text-sm md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className="hidden max-w-64 truncate text-muted-foreground lg:inline"
            title={email ?? ""}
          >
            {orgName ? `${orgName} · ` : ""}
            {email}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        {orgName && (
          <nav
            aria-label="App, compact"
            className="-mx-6 flex w-[calc(100%+3rem)] gap-1 overflow-x-auto border-t px-6 pt-2 text-sm md:hidden"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
