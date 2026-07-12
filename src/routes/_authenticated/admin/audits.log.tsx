import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listAuditLog } from "@/lib/admin.functions";
import { Wordmark } from "@/components/marketing/Wordmark";

const auditQuery = queryOptions({
  queryKey: ["audit-log"],
  queryFn: () => listAuditLog({ data: { limit: 200 } }),
});

export const Route = createFileRoute("/_authenticated/admin/audits/log")({
  head: () => ({
    meta: [
      { title: "Audit log — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(auditQuery),
  component: AuditLogPage,
});

function AuditLogPage() {
  const { data: rows } = useSuspenseQuery(auditQuery);

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Admin · Audit log</span>
        </div>
        <Link to="/admin" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">← Admin</Link>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-16">
        <h1 className="font-serif text-4xl">Audit log</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-500">Most recent {rows.length} administrative and configuration events.</p>

        <table className="mt-10 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Actor</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Target</th>
              <th className="py-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-ink-500">No audit entries yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-200 align-top">
                <td className="py-2 pr-4 font-mono text-[11px] text-ink-500">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 pr-4 font-mono text-[11px] text-ink-500">{r.actor_label ?? r.actor_id?.slice(0, 8) ?? "system"}</td>
                <td className="py-2 pr-4">{r.action}</td>
                <td className="py-2 pr-4 font-mono text-[11px] text-ink-500">{r.target_type ?? "—"}{r.target_id ? ` · ${r.target_id.slice(0, 12)}` : ""}</td>
                <td className="py-2 font-mono text-[10px] text-ink-500">{Object.keys(r.metadata ?? {}).length > 0 ? JSON.stringify(r.metadata) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
