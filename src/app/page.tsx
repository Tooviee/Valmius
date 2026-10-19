import Link from "next/link";
import { NotifyForm } from "@/components/landing/notify-form";
import { ScreenshotFrame } from "@/components/landing/screenshot-frame";
import { TimelineArt } from "@/components/landing/timeline-art";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";

// Copy follows SPEC.md section 9.1: name the exact control IDs we evidence, nothing broader,
// and never claim that Valmius makes a company compliant.
const DRIVERS = [
  {
    id: "PCI DSS 12.10.2",
    asks: "Review and test the incident response plan at least once every 12 months.",
  },
  {
    id: "SOC 2 CC7.4",
    asks: "Respond to identified security incidents through a defined program. Auditors expect at least annual tabletop evidence.",
  },
  {
    id: "Cyber insurance questionnaires",
    asks: "Do you have an incident response plan, and when did you last test it?",
  },
  {
    id: "NYDFS 500.16",
    asks: "Maintain a written incident response plan and test it at least annually.",
  },
];

const STEPS = [
  {
    name: "Plan",
    title: "A written plan from fifteen questions",
    text: "Answer fifteen questions about your systems, people and obligations. Valmius writes an eleven-section incident response plan with roles, severity levels and a notification matrix built from your actual deadlines. Edit any section, approve it by name, export PDF or Word.",
    image: {
      src: "/screens/plan.png",
      alt: "The plan editor showing the roles and responsibilities section with a table of roles, backups and duties",
      width: 1400,
      height: 900,
    },
  },
  {
    name: "Drill",
    title: "A tabletop exercise your team can run in an hour",
    text: "Pick a scenario or generate one from your own plan. The facilitator console shows one inject at a time with discussion questions; every decision is logged with a server timestamp. Participants follow along on their phones and sign off at the end.",
    image: {
      src: "/screens/console.png",
      alt: "The facilitator console with the current inject, the decision log and the timer",
      width: 1400,
      height: 900,
    },
  },
  {
    name: "Prove",
    title: "A dated report an auditor accepts",
    text: "Attendance, the decision timeline, strengths, gaps, action items with owners, and the controls the exercise evidences, in a PDF with a recorded SHA-256. The evidence vault shows every exercise and when the next test is due.",
    image: {
      src: "/screens/report.png",
      alt: "An after-action report with the participants table and the decision timeline",
      width: 1400,
      height: 900,
    },
  },
];

const COVERAGE = [
  { framework: "SOC 2 (TSC 2017)", controls: "CC7.3, CC7.4, CC7.5" },
  { framework: "PCI DSS v4.0.1", controls: "12.10.1, 12.10.2, 12.10.6" },
  { framework: "ISO/IEC 27001:2022", controls: "A.5.24, A.5.26, A.5.27" },
  { framework: "NIST CSF 2.0", controls: "ID.IM-02, ID.IM-04" },
  { framework: "HIPAA Security Rule", controls: "164.308(a)(6)(ii)" },
  { framework: "CMMC 2.0 L2 / NIST 800-171", controls: "3.6.1, 3.6.2, 3.6.3" },
  { framework: "NYDFS 23 NYCRR 500", controls: "500.16" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{children}</p>;
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="paper overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-20 pb-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-28 lg:pb-20">
            <div className="max-w-xl space-y-7">
              <div className="rise">
                <Eyebrow>Incident response, practiced</Eyebrow>
              </div>
              <h1 className="rise rise-delay-1 font-display text-[3.25rem] leading-[1] font-medium tracking-tight text-balance sm:text-6xl lg:text-[4.75rem]">
                Write the plan.
                <br />
                Run the drill.
                <br />
                <em className="text-primary">Keep the proof.</em>
              </h1>
              <p className="rise rise-delay-2 text-lg leading-relaxed text-muted-foreground text-pretty">
                Valmius is for companies with 10 to 200 employees and nobody whose full-time job is
                security. It writes your incident response plan, runs the tabletop exercise with
                your team, and produces the dated after-action report that auditors, insurers and
                regulators ask for.
              </p>
              <div className="rise rise-delay-3 flex flex-wrap items-center gap-3">
                <Link href="/generate" className={buttonVariants({ size: "lg" })}>
                  Generate a free tabletop scenario
                </Link>
                <a href="#notify" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  Notify me at launch
                </a>
              </div>
              <p className="rise rise-delay-3 text-sm text-muted-foreground">
                The free generator is live today. The full product is in development.
              </p>
            </div>
            <div className="rise rise-delay-2 relative lg:pl-6">
              {/* A deep-blue stage that bleeds past the column; the screenshot sits on it. */}
              <div
                aria-hidden="true"
                className="stage absolute -inset-x-6 -top-8 -bottom-8 -z-10 rounded-[2rem] sm:-top-10 sm:-bottom-10 lg:-right-28 lg:-left-2"
              />
              <ScreenshotFrame
                src="/screens/plan.png"
                alt="The Valmius plan editor: an incident response plan with numbered sections and framework references"
                width={1400}
                height={900}
                priority
                className="relative"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-4 -left-2 hidden w-64 rounded-xl border bg-card p-4 shadow-xl sm:block lg:-left-8"
              >
                <p className="text-[0.65rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Decision logged
                </p>
                <p className="mt-1 font-mono text-xs text-primary">10:42:17 · Inject 4</p>
                <p className="mt-1 text-sm leading-snug">
                  Isolate the build server; keep the laptops on.
                </p>
              </div>
            </div>
          </div>
          <div className="mx-auto hidden w-full max-w-6xl px-6 pt-8 pb-16 sm:block">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-baseline justify-between text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                <span>A drill, minute by minute</span>
                <span className="hidden md:inline">Every decision carries a server timestamp</span>
              </div>
              <TimelineArt className="mt-2 w-full" />
            </div>
          </div>
        </section>

        {/* Drivers */}
        <section className="border-y bg-[var(--tint)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <div className="max-w-2xl space-y-3">
              <Eyebrow>Why now</Eyebrow>
              <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                What the people who check your work ask for
              </h2>
              <p className="leading-relaxed text-muted-foreground text-pretty">
                Four requirements that come up for almost every company our size. Each one wants a
                written plan and a dated record that it was tested.
              </p>
            </div>
            <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
              {DRIVERS.map((driver, index) => (
                <div key={driver.id} className="space-y-3 bg-background p-7">
                  <span className="font-display text-4xl text-primary/55 italic" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <dt className="font-medium">{driver.id}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{driver.asks}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="max-w-2xl space-y-3">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Three steps, one record
            </h2>
          </div>
          <ol className="mt-14 space-y-20">
            {STEPS.map((step, index) => (
              <li key={step.name} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                <div className={`space-y-4 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <p
                    className="font-display text-6xl leading-none text-primary/45 italic"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </p>
                  <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    {step.name}
                  </p>
                  <h3 className="font-display text-2xl font-medium tracking-tight text-balance sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="leading-relaxed text-muted-foreground text-pretty">{step.text}</p>
                </div>
                <ScreenshotFrame
                  src={step.image.src}
                  alt={step.image.alt}
                  width={step.image.width}
                  height={step.image.height}
                  className={index % 2 === 1 ? "lg:order-1" : ""}
                />
              </li>
            ))}
          </ol>
        </section>

        {/* Positioning */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="hairline" />
          <blockquote className="mx-auto max-w-3xl py-16 text-center">
            <p className="font-display text-2xl leading-snug font-medium text-balance sm:text-3xl">
              Your cloud provider inherits the data center. Your compliance platform automates the
              configuration evidence. Your team still has to practice the response.{" "}
              <span className="text-primary">We cover that last part.</span>
            </p>
          </blockquote>
          <div className="hairline" />
        </section>

        {/* Coverage */}
        <section className="border-y bg-[var(--tint)]">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <Eyebrow>Scope, exactly</Eyebrow>
              <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                What we cover, and nothing broader
              </h2>
              <p className="leading-relaxed text-muted-foreground text-pretty">
                Valmius produces the evidence auditors ask for under these controls. It does not
                make a company compliant; no single tool does.
              </p>
            </div>
            <ul className="divide-y rounded-2xl border bg-background">
              {COVERAGE.map((row) => (
                <li
                  key={row.framework}
                  className="flex items-baseline justify-between gap-6 px-6 py-4 text-sm"
                >
                  <span className="font-medium">{row.framework}</span>
                  <span className="text-right font-mono text-xs text-muted-foreground">
                    {row.controls}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Notify */}
        <section id="notify" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-20">
          <div className="mx-auto max-w-2xl space-y-5 text-center">
            <Eyebrow>Launch</Eyebrow>
            <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Be the first company to run a drill
            </h2>
            <p className="leading-relaxed text-muted-foreground text-pretty">
              Leave your work email and we will tell you when the plan generator, the exercise
              runner and the evidence vault open up.
            </p>
            <div className="mx-auto max-w-md text-left">
              <NotifyForm />
            </div>
            <p className="text-xs text-muted-foreground">
              Used only for the launch announcement. Nothing is emailed to you today.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
