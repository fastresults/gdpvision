import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Radar, FolderOpen } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listSignals } from "@/lib/narrative-chamber.functions";
import { AddSignalDialog } from "@/components/narrative/AddSignalDialog";
import { SignalTriageRail } from "@/components/narrative/SignalTriageRail";
import { CoverageBadge } from "@/components/narrative/CoverageBadge";


function signalsQuery(code: string) {
  return queryOptions({
    queryKey: ["narrative-signals", code],
    queryFn: () => listSignals({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/narrative")({
  head: ({ params }) => ({
    meta: [
      { title: `Narrative Chamber · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(signalsQuery(params.code));
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8">
      <p className="max-w-md text-sm text-rose-600">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-ink-500">Narrative Chamber not found.</div>
  ),
  component: NarrativeLayout,
});

function NarrativeLayout() {
  const { code } = Route.useParams();
  const { data: signals } = useSuspenseQuery(signalsQuery(code));
  const params = useParams({ strict: false }) as { id?: string };

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Chamber 05 · Narrative Chamber" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="min-w-0 space-y-4 border-r border-line-200 pr-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Narrative Chamber
            </p>
            <h1 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
              Signal to statement.<br />Inside a working day.
            </h1>
            <p className="mt-3 text-sm text-ink-700">
              Monitor local, regional and international narratives. Triage, position, and
              publish — every step grounded in the country&rsquo;s second brain.
            </p>
          </div>

          <AddSignalDialog code={code} />

          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <Radar size={11} /> Active signals · {signals.length}
            </p>
            <div className="mt-2">
              {signals.length === 0 ? (
                <div className="border border-dashed border-line-200 p-3 text-xs text-ink-500">
                  No signals yet. Ingest one to begin.
                </div>
              ) : (
                <SignalTriageRail signals={signals} code={code} activeId={params.id} />
              )}
            </div>
          </div>

          <Link
            to="/admin/countries/$code/narrative/library"
            params={{ code }}
            className="mt-4 flex items-center gap-2 border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:bg-paper-100"
            activeProps={{ className: "bg-ink-950 text-paper-0 border-ink-950" }}
          >
            <FolderOpen size={13} /> Comms Library
          </Link>


          <Link
            to="/admin/countries/$code/onboard"
            params={{ code }}
            className="mt-6 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            ← Back to country
          </Link>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SuperAdminShell>
  );
}
