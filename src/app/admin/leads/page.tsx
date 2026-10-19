import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

const DAYS = 30;
const LEAD_LIMIT = 200;

const formatDate = (iso: string) => iso.replace("T", " ").slice(0, 16);

async function loadAdminData() {
  const supabase = getAdminClient();
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [leads, counts] = await Promise.all([
    supabase
      .from("leads")
      .select("id, email, industry, headcount_band, scenario_type, source, created_at")
      .order("created_at", { ascending: false })
      .limit(LEAD_LIMIT),
    supabase.rpc("event_counts_by_day", { p_since: since }),
  ]);
  if (leads.error) throw new Error(`Could not load leads: ${leads.error.message}`);
  if (counts.error) throw new Error(`Could not load event counts: ${counts.error.message}`);
  return { leads: leads.data, counts: counts.data };
}

/** Phase 1 admin view: recent leads and event counts by day. Replaced by real auth in Phase 2. */
export default async function AdminLeadsPage() {
  // src/proxy.ts has already challenged for credentials; this keeps the page from ever
  // rendering without them, whatever happens to the proxy matcher.
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();

  const { leads, counts } = await loadAdminData();

  const eventNames = [...new Set(counts.map((row) => row.name))].sort();
  const days = [...new Set(counts.map((row) => row.day))];
  const countFor = (day: string, name: string) =>
    counts.find((row) => row.day === day && row.name === name)?.count ?? 0;

  return (
    <main id="main" className="mx-auto w-full max-w-5xl space-y-12 px-6 py-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Most recent {leads.length} of up to {LEAD_LIMIT}. Times are UTC.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Scenario</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No leads yet.
                </TableCell>
              </TableRow>
            )}
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.email}</TableCell>
                <TableCell>{lead.source}</TableCell>
                <TableCell>{lead.industry ?? ""}</TableCell>
                <TableCell>{lead.headcount_band ?? ""}</TableCell>
                <TableCell>{lead.scenario_type ?? ""}</TableCell>
                <TableCell>{formatDate(lead.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Events by day</h2>
          <p className="text-sm text-muted-foreground">Last {DAYS} days, UTC.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              {eventNames.map((name) => (
                <TableHead key={name} className="text-right">
                  {name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.length === 0 && (
              <TableRow>
                <TableCell className="text-muted-foreground">No events yet.</TableCell>
              </TableRow>
            )}
            {days.map((day) => (
              <TableRow key={day}>
                <TableCell className="font-medium">{day}</TableCell>
                {eventNames.map((name) => (
                  <TableCell key={name} className="text-right tabular-nums">
                    {countFor(day, name)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
