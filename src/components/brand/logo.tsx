import Link from "next/link";
import { cn } from "cn";

/** The Valmius mark: a V drawn as a single stroke on a deep blue tile. */
export function Mark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path
        d="M17 19 L32 47 L47 19"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark plus the name in the display face. Links to `href`. */
export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 text-primary no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md",
        className,
      )}
      aria-label="Valmius home"
    >
      <Mark />
      <span className="font-display text-[1.35rem] leading-none font-medium tracking-tight text-foreground">
        Valmius
      </span>
    </Link>
  );
}
