import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-6 py-24 text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">404</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
          This page does not exist
        </h1>
        <p className="mt-3 text-muted-foreground">
          The link may be old, or the address was typed incompletely. Participant links stop working
          30 days after an exercise ends.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className={buttonVariants()}>
            Home
          </Link>
          <Link href="/app" className={buttonVariants({ variant: "outline" })}>
            Open the app
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
