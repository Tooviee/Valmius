import Image from "next/image";
import { cn } from "cn";

/** A product screenshot in a quiet window frame. Images come from scripts/screenshots.ts. */
export function ScreenshotFrame({
  src,
  alt,
  width,
  height,
  caption,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_30px_60px_-30px_oklch(0.36_0.13_262/0.35)] ring-1 ring-foreground/5">
        <div
          className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2"
          aria-hidden="true"
        >
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className="block h-auto w-full"
        />
      </div>
      {caption && <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
