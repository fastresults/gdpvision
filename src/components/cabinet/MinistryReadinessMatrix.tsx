import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMinistryReadiness, type MinistryReadinessRow } from "@/lib/cabinet.functions";
import { UserRound, AlertCircle, CheckCircle2 } from "lucide-react";

export function readinessQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet","readiness", code],
    queryFn: () => getMinistryReadiness({ data: { countryCode: code } }),
  });
}

function tone(v: number): string {
  if (v >= 70) return "bg-emerald-500";
  if (v >= 40) return "bg-gold-500";
  if (v >= 20) return "bg-amber-500";
  return "bg-red-500/70";
}

export function MinistryReadinessMatrix({ code }: { code: string }) {
  const { data } = useSuspenseQuery(readinessQuery(code));
  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Ministry readiness</div>
          <h2 className="font-serif text-2xl">Who is ready to walk in?</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{data.length} ministries</div>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((r: MinistryReadinessRow) => (
          <article key={r.ministryId} className="border border-line-200 bg-paper-0 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink-950">{r.name}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-500">
                  <UserRound size={11} /> {r.minister ?? <span className="italic text-ink-400">Minister unknown</span>}
                </div>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] tabular-nums text-ink-950">{r.readiness}</div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line-200">
              <div className={`h-full ${tone(r.readiness)}`} style={{ width: `${r.readiness}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={10} /> {r.deliveredCommitments} delivered</span>
              <span>· {r.openCommitments} open</span>
              {r.overdueCommitments > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle size={10} /> {r.overdueCommitments} overdue</span>
              )}
              {r.sponsoredAgendaItems > 0 && <span>· {r.sponsoredAgendaItems} on agenda</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
