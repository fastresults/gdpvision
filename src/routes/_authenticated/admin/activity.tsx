import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listOnboardingRuns } from "@/lib/country-onboarding/agents.functions";

const runsQuery = queryOptions({
  queryKey: ["onboarding", "runs"],
  queryFn: () => listOnboardingRuns(),
});

const STATUSES = ["all", "planning", "researching", "ready", "committed", "failed"] as const;
type StatusFilter = (typeof STATUSES)[number];

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({
    meta: [
      { title: "Agent activity — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(runsQuery),
  component: ActivityPage,
  errorComponent: ({ error }) => (
    <SuperAdminShell crumbs={[{ label: "Activity" }]}>
      <p className="text-sm text-red-600">{error.message}</p>
    </SuperAdminShell>
  ),
  notFoundComponent: () => (
    <SuperAdminShell crumbs={[{ label: "Activity" }]}>
      <p className="text-sm">Not found.</p>
    </SuperAdminShell>
  ),
});

function ActivityPage() {
  const { data: runs } = useSuspenseQuery(runsQuery);
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(
    () => (status === "all" ? runs : runs.filter((r: any) => r.status === status)),
    [runs, status],
  );

  return (
    <SuperAdminShell crumbs={[{ label: "Activity" }]}>
      <div className="space-y-4">
        <div>
          <h1 className="font-serif text-3xl">Agent activity</h1>
          <p className="mt-2 text-sm text-ink-500">
            The last 200 deep-research runs across every country. Failures show the model's error so you can retry.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] border ${
                status === s
                  ? "border-ink-950 bg-ink-950 text-paper-0"
                  : "border-line-200 text-ink-500 hover:text-ink-950"
              }`}
            >
              {s} {s !== "all" && `(${runs.filter((r: any) => r.status === s).length})`}
            </button>
          ))}
        </div>

        <div className="border border-line-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-100 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <tr className="text-left">
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">
                    No runs yet.
                  </td>
                </tr>
              )}
              {filtered.map((r: any) => {
                const model = (r.model_stack && (r.model_stack.research || Object.values(r.model_stack)[0])) as string | undefined;
                return (
                  <tr key={r.id} className="border-t border-line-200 align-top">
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/countries/$code/onboard"
                        params={{ code: r.country_code }}
                        className="hover:underline"
                      >
                        {r.country_name ?? r.country_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.stage}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                      {r.error && (
                        <div className="mt-1 text-[11px] text-red-600 max-w-md whitespace-pre-wrap">
                          {r.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{model ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-right text-ink-500">
                      {r.cost_cents ? `$${(r.cost_cents / 100).toFixed(3)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/countries/$code/onboard"
                        params={{ code: r.country_code }}
                        className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    committed: "bg-emerald-500/15 text-emerald-700",
    ready: "bg-amber-500/15 text-amber-700",
    researching: "bg-sky-500/15 text-sky-700",
    planning: "bg-ink-200 text-ink-700",
    failed: "bg-red-500/15 text-red-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${map[status] ?? "bg-ink-200 text-ink-700"}`}>
      {status}
    </span>
  );
}
