import { Mark } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Mark size={20} />
          <span className="font-display text-base text-foreground">Valmius</span>
        </div>
        <div className="max-w-xl space-y-2">
          <p>
            Valmius produces evidence for specific incident response controls. It does not, on its
            own, make a company compliant with any framework.
          </p>
          <p>We never ask for health data or card numbers. Please do not enter any.</p>
        </div>
      </div>
    </footer>
  );
}
