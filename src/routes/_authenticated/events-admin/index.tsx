import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { eventsDashboard } from "@/lib/events/admin-toolkit.functions";
import { formatEventDate } from "@/components/events/EventParts";

export const Route = createFileRoute("/_authenticated/events-admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Events Admin" }, { name: "description", content: "GDP Events at a glance." }, { property: "og:title", content: "Dashboard — Events Admin" }, { property: "og:description", content: "GDP Events at a glance." }] }),
  component: Dashboard,
});

const GAP_LABEL: Record<string, string> = { dates: "Dates", venue: "Venue", description: "Description", photo: "Photo", agenda: "Agenda", speakers: "Speakers" };

function Dashboard() {
  const fn = useServerFn(eventsDashboard);
  const q = useQuery({ queryKey: ["events-admin", "dashboard"], queryFn: () => fn() });
  if (q.isLoading) return <p>Loading…</p>;
  if (q.error) return <p className="text-signal-red">{(q.error as Error).message}</p>;
  const d = q.data!;
  const published = d.events.filter((e) => e.status === "published").length;
  const waitlist = d.events.reduce((n, e) => n + e.waitlist, 0);
  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Editions" value={d.events.length} tone="bg-ev-sea" />
        <Stat label="Published" value={published} tone="bg-ev-palm text-ev-paper" />
        <Stat label="Registrations this week" value={d.registrationsThisWeek} tone="bg-ev-mango" />
        <Stat label="On waitlists" value={waitlist} tone="bg-ev-coral" />
      </div>
      <section>
        <h2 className="ev-display text-[44px]">Editions and gaps to fill</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border-4 border-ev-ink">
          <table className="w-full text-[14px]">
            <thead className="bg-ev-ink text-left text-ev-paper">
              <tr><th className="p-3">Edition</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3 text-right">Confirmed / waitlist</th><th className="p-3">Still missing</th></tr>
            </thead>
            <tbody>
              {d.events.map((e) => (
                <tr key={e.id} className="border-t-2 border-ev-ink/20">
                  <td className="p-3 font-semibold">{e.title}</td>
                  <td className="p-3">{formatEventDate(e.starts_at)}</td>
                  <td className="p-3">{e.status === "published" ? "Published" : "Draft"}</td>
                  <td className="p-3 text-right tabular-nums">{e.confirmed} / {e.waitlist}{e.capacity ? ` of ${e.capacity}` : ""}</td>
                  <td className="p-3">
                    {e.gaps.length === 0 ? "Complete" : (
                      <span className="flex flex-wrap gap-1">
                        {e.gaps.map((g) => <span key={g} className="rounded-full border-2 border-ev-ink px-2 py-0.5 text-[12px] font-bold">{GAP_LABEL[g]}</span>)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px]">
          Fill gaps in <Link to="/events-admin/events" className="underline">Events</Link> and <Link to="/events-admin/programme" className="underline">Agenda, speakers &amp; media</Link>. {d.enquiries} host enquiries waiting in <Link to="/events-admin/enquiries" className="underline">Enquiries</Link>.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl border-4 border-ev-ink p-5 ${tone}`}>
      <div className="ev-display text-[56px] leading-none tabular-nums">{value}</div>
      <div className="mt-2 text-[13px] font-bold uppercase tracking-wider">{label}</div>
    </div>
  );
}
