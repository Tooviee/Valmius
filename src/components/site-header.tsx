import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav aria-label="Site" className="flex items-center gap-5 text-sm">
          <Link
            href="/generate"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Free scenario generator
          </Link>
          <Link href="/login" className="font-medium transition-colors hover:text-primary">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
