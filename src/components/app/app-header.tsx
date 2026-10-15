import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/questionnaire", label: "Questionnaire" },
  { href: "/app/plan", label: "IR plan" },
  { href: "/app/exercises", label: "Exercises" },
] as const;

/** The signed-in shell's header: brand, app navigation (once an org exists) and sign-out. */
export function AppHeader({ email, orgName }: { email: string | null; orgName: string | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-6">
          <Link href="/app" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
            >
              D
            </span>
            Drill Day
          </Link>
          {orgName && (
            <nav aria-label="App" className="hidden items-center gap-4 text-sm sm:flex">
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
          <span className="hidden truncate text-muted-foreground md:inline" title={email ?? ""}>
            {orgName ? `${orgName} · ` : ""}
            {email}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
