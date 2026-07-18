import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AlertOctagon, ChevronRight, ShieldCheck } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listStudioContext, listThreats } from "@/lib/fdi-resilience.functions";

function ctxQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-ctx", code],
    queryFn: () => listStudioContext({ data: { countryCode: code } }),
  });
}
function threatsQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-threats", code],
    queryFn: () => listThreats({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/studio")({
  head: ({ params }) => ({
    meta: [
      { title: `FDI Transition Studio · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ctxQuery(params.code)),
      context.queryClient.ensureQueryData(threatsQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-red-600">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-ink-500">Studio not found.</div>
  ),
  component: StudioLayout,
});

function StudioLayout() {
  const { code } = Route.useParams();
  const { data: threats } = useSuspenseQuery(threatsQuery(code));
  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Chamber 04 · FDI Transition Studio" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 border-r border-line-200 pr-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              FDI Transition Studio
            </p>
            <h1 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
              Threat in.<br />Resilient strategy out.
            </h1>
            <p className="mt-3 text-sm text-ink-700">
              A shock hits a sector. Reshape the FDI portfolio to absorb it —
              sector by sector, ministry by ministry.
            </p>
          </div>
          <Link
            to="/admin/countries/$code/studio"
            params={{ code }}
            activeOptions={{ exact: true }}
            activeProps={{ className: "border-ink-950 bg-ink-950 text-paper-0" }}
            className="flex items-center justify-between border border-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:bg-ink-950 hover:text-paper-0"
          >
            <span className="flex items-center gap-2">
              <AlertOctagon size={13} /> New threat
            </span>
            <ChevronRight size={13} />
          </Link>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Active threats
            </p>
            <ul className="mt-2 space-y-1">
              {threats.length === 0 && (
                <li className="text-xs text-ink-500">No threats framed yet.</li>
              )}
              {threats.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/admin/countries/$code/studio/threats/$id"
                    params={{ code, id: t.id }}
                    activeProps={{ className: "bg-paper-100 text-ink-950" }}
                    className="block border border-line-200 px-3 py-2 text-sm text-ink-700 hover:border-ink-950"
                  >
                    <span className="block truncate">{t.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                      <ShieldCheck size={10} /> {t.threat_type.replace(/_/g, " ")} ·{" "}
                      {t.severity_pct}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SuperAdminShell>
  );
}
