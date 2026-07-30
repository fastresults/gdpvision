import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listKeyingAudits, runKeyingAudit } from "@/lib/audits.functions";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/marketing/Wordmark";
import { scrollToTop } from "@/lib/utils";

const auditsQuery = queryOptions({ queryKey: ["keying-audits"], queryFn: () => listKeyingAudits() });

export const Route = createFileRoute("/_authenticated/admin/audits/keying")({
  head: () => ({
    meta: [
      { title: "Keying Audit — GDPVision" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Universal country + sector keying audit across all domain tables." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(auditsQuery),
  component: KeyingAuditsPage,
});

function KeyingAuditsPage() {
  const { data: audits } = useSuspenseQuery(auditsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const run = useServerFn(runKeyingAudit);
  const mut = useMutation({
    mutationFn: () => run({ data: undefined } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keying-audits"] }),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const latest = audits[0];

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument" onClick={() => scrollToTop()}><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Admin · Audits · Keying</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/admin" className="hover:text-ink-950">Admin</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Definition-of-Done gate</p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-4xl">Country + sector keying audit</h1>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="rounded border border-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
          >
            {mut.isPending ? "Running…" : "Run audit now"}
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-ink-500">
          Walks every domain table and confirms each row carries valid country_code and (where applicable) sector_code
          references. A clean audit is a v1.0 release gate.
        </p>

        {mut.isError && (
          <p className="mt-6 text-sm text-red-600">{(mut.error as Error).message}</p>
        )}

        {!latest ? (
          <div className="mt-16 border border-dashed border-line-200 p-10 text-center text-sm text-ink-500">
            No audits recorded yet. Run one to establish a baseline.
          </div>
        ) : (
          <section className="mt-12">
            <header className="flex items-baseline justify-between border-b border-line-200 pb-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Latest run</h2>
              <span className="font-mono text-[11px] text-ink-500">
                {new Date(latest.ran_at).toLocaleString()} · {latest.total_checked.toLocaleString()} rows ·{" "}
                <span className={latest.total_violations === 0 ? "text-emerald-700" : "text-red-600"}>
                  {latest.total_violations.toLocaleString()} violations
                </span>
              </span>
            </header>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  <th className="py-2">Table</th>
                  <th className="py-2 text-right">Rows</th>
                  <th className="py-2">Violations</th>
                </tr>
              </thead>
              <tbody>
                {latest.report.perTable.map((t) => (
                  <tr key={t.table} className="border-b border-line-200">
                    <td className="py-2 font-mono text-[12px]">{t.table}</td>
                    <td className="py-2 text-right font-mono text-[12px]">{t.rows.toLocaleString()}</td>
                    <td className="py-2">
                      {t.violations.length === 0 ? (
                        <span className="font-mono text-[11px] text-emerald-700">clean</span>
                      ) : (
                        <span className="font-mono text-[11px] text-red-600">
                          {t.violations.map((v) => `${v.kind}: ${v.count}`).join(" · ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {audits.length > 1 && (
          <section className="mt-16">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">History</h2>
            <ul className="mt-4 divide-y divide-line-200 border-y border-line-200">
              {audits.slice(1).map((a) => (
                <li key={a.id} className="grid grid-cols-[1fr_auto_auto] gap-6 py-3 font-mono text-[11px] text-ink-500">
                  <span>{new Date(a.ran_at).toLocaleString()}</span>
                  <span>{a.total_checked.toLocaleString()} rows</span>
                  <span className={a.total_violations === 0 ? "text-emerald-700" : "text-red-600"}>
                    {a.total_violations.toLocaleString()} violations
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
