import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
          >
            D
          </span>
          Drill Day
        </Link>
        <nav className="text-sm">
          <Link
            href="/generate"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Free scenario generator
          </Link>
        </nav>
      </div>
    </header>
  );
}
