import Link from "next/link";
import { NotifyForm } from "@/components/landing/notify-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

// Copy follows SPEC.md section 9.1: name the exact control IDs we evidence, nothing broader,
// and never claim that Drill Day makes a company compliant.
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
    text: "Answer fifteen questions about your company. Get a written incident response plan with roles, severity levels and a notification matrix built from your actual obligations.",
  },
  {
    name: "Drill",
    text: "Run a tabletop exercise with three to six colleagues: a timer, scripted injects, discussion questions and a timestamped decision log.",
  },
  {
    name: "Prove",
    text: "Download a dated after-action report with attendance, decisions, gaps, action items and the controls the exercise gives evidence toward.",
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

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16">
          <div className="max-w-2xl space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Write your incident response plan, practice it, and keep the dated proof.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Drill Day is for companies with 10 to 200 employees and nobody whose full-time job is
              security. It writes the plan, runs the tabletop exercise with your team, and produces
              the after-action report that auditors, insurers and regulators ask for.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/generate" />}>
                Generate a free tabletop scenario
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<a href="#notify" />}
              >
                Notify me when it launches
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              The free generator is live today. The full product is in development.
            </p>
          </div>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">
              What the people who check your work ask for
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Four requirements that come up for almost every company our size. Each one wants a
              written plan and a dated record that it was tested.
            </p>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {DRIVERS.map((driver) => (
                <div key={driver.id} className="rounded-xl border bg-background p-5">
                  <dt className="font-medium">{driver.id}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {driver.asks}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.name} className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Step {index + 1}
                </p>
                <h3 className="text-lg font-semibold">{step.name}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <blockquote className="mt-12 max-w-3xl border-l-2 pl-5 text-lg leading-relaxed text-balance">
            Your cloud provider inherits the data center. Your compliance platform automates the
            configuration evidence. Your team still has to practice the response. We cover that last
            part.
          </blockquote>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">What we cover, exactly</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Drill Day produces the evidence auditors ask for under these controls, and nothing
              broader. It does not make a company compliant; no single tool does.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {COVERAGE.map((row) => (
                <li
                  key={row.framework}
                  className="flex items-baseline justify-between gap-4 rounded-xl border bg-background px-5 py-3 text-sm"
                >
                  <span className="font-medium">{row.framework}</span>
                  <span className="text-right text-muted-foreground">{row.controls}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="notify" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-16">
          <div className="max-w-xl space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Get notified when the full product launches
            </h2>
            <p className="text-muted-foreground">
              Leave your work email and we will tell you when the plan generator, the exercise
              runner and the evidence vault are ready.
            </p>
            <NotifyForm />
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
