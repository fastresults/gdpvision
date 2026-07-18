import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCommitmentsCockpit } from "@/lib/cabinet.functions";

export function cockpitQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet","cockpit", code],
    queryFn: () => getCommitmentsCockpit({ data: { countryCode: code } }),
  });
}

const STATUSES = ["open","in_progress","delivered","blocked","cancelled"] as const;

export function CommitmentsCockpit({ code }: { code: string }) {
  const { data } = useSuspenseQuery(cockpitQuery(code));

  // Build per-ministry rows
  const ministries = Array.from(new Set(data.cells.map((c) => c.ministryName)));
  const totalPerMin = new Map<string, number>();
  data.cells.forEach((c) => totalPerMin.set(c.ministryName, (totalPerMin.get(c.ministryName) ?? 0) + c.count));
  ministries.sort((a, b) => (totalPerMin.get(b) ?? 0) - (totalPerMin.get(a) ?? 0));
  const maxTotal = Math.max(1, ...Array.from(totalPerMin.values()));

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Commitments cockpit</div>
          <h2 className="font-serif text-2xl">Are yesterday&rsquo;s decisions turning into delivery?</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {data.medianCloseDays !== null ? `median close · ${Math.round(data.medianCloseDays)}d` : "no closed items yet"}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr,1fr]">
        <div className="border border-line-200 bg-paper-0 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">Ministry × status</div>
          {ministries.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-500">No commitments on the books.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {ministries.slice(0, 12).map((m) => {
                const total = totalPerMin.get(m) ?? 0;
                return (
                  <li key={m} className="grid grid-cols-[180px,1fr,40px] items-center gap-3">
                    <span className="truncate text-xs text-ink-950">{m}</span>
                    <div className="flex h-4 overflow-hidden border border-line-200" style={{ width: `${(total / maxTotal) * 100}%`, minWidth: 40 }}>
                      {STATUSES.map((s) => {
                        const cell = data.cells.find((c) => c.ministryName === m && c.status === s);
                        const w = total > 0 ? ((cell?.count ?? 0) / total) * 100 : 0;
                        const cls = s === "delivered" ? "bg-emerald-500" : s === "open" ? "bg-ink-950/80" : s === "in_progress" ? "bg-gold-500" : s === "blocked" ? "bg-red-500/80" : "bg-ink-300";
                        return w > 0 ? <div key={s} className={cls} style={{ width: `${w}%` }} title={`${s}: ${cell?.count}`} /> : null;
                      })}
                    </div>
                    <span className="text-right font-mono text-[10px] tabular-nums text-ink-500">{total}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3 border-t border-line-200 pt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
            <Legend swatch="bg-ink-950/80" label={`open · ${data.totals.open ?? 0}`} />
            <Legend swatch="bg-gold-500" label={`in progress · ${data.totals.in_progress ?? 0}`} />
            <Legend swatch="bg-emerald-500" label={`delivered · ${data.totals.delivered ?? 0}`} />
            <Legend swatch="bg-red-500/80" label={`blocked · ${data.totals.blocked ?? 0}`} />
          </div>
        </div>

        <div className="border border-line-200 bg-paper-0 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">Ageing · open items</div>
          <ul className="mt-3 space-y-2">
            {data.ageingBuckets.map((b) => {
              const max = Math.max(1, ...data.ageingBuckets.map((x) => x.count));
              return (
                <li key={b.bucket} className="grid grid-cols-[80px,1fr,40px] items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{b.bucket}</span>
                  <div className="h-2 bg-line-200">
                    <div className={`h-full ${b.bucket === ">180d" ? "bg-red-500" : b.bucket === "90–180d" ? "bg-gold-500" : "bg-ink-950/80"}`} style={{ width: `${(b.count / max) * 100}%` }} />
                  </div>
                  <span className="text-right font-mono text-[10px] tabular-nums text-ink-500">{b.count}</span>
                </li>
              );
            })}
          </ul>
          {data.breaches.length > 0 && (
            <div className="mt-4 border-t border-line-200 pt-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-600">SLA breaches</div>
              <ul className="mt-2 space-y-1">
                {data.breaches.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-baseline justify-between gap-2 text-[11px] text-ink-950">
                    <span className="truncate">{b.title}</span>
                    <span className="font-mono text-[10px] text-red-600 tabular-nums">+{b.daysOverdue}d</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block h-2 w-2 ${swatch}`} />{label}</span>;
}
