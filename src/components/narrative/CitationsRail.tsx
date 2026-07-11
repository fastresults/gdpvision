import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { factCheckBody, listCitationCandidates } from "@/lib/factcheck.functions";

interface Source { label: string; ref: string }

export function CitationsRail({
  scopeKey,
  sectorCode,
  sources,
  onAttach,
  onRemove,
  body,
  showFactCheck = false,
}: {
  scopeKey: string;
  sectorCode?: string;
  sources: Source[];
  onAttach: (s: Source) => void;
  onRemove: (ref: string) => void;
  body?: string;
  showFactCheck?: boolean;
}) {
  const candidatesQuery = queryOptions({
    queryKey: ["citations", scopeKey, sectorCode ?? ""],
    queryFn: () => listCitationCandidates({ data: { scopeKey, sectorCode } }),
  });
  const { data: candidates = [] } = useQuery(candidatesQuery);
  const attached = new Set(sources.map((s) => s.ref));

  const factCheck = useServerFn(factCheckBody);
  const [report, setReport] = useState<Awaited<ReturnType<typeof factCheckBody>> | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (!body) return;
    setRunning(true);
    try {
      const r = await factCheck({ data: { scopeKey, body } });
      setReport(r);
    } finally {
      setRunning(false);
    }
  }

  return (
    <aside className="space-y-8">
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Citation candidates</h3>
        <p className="mt-1 text-xs text-ink-500">Second-Brain memory objects for this sector.</p>
        <ul className="mt-3 space-y-1 text-sm">
          {candidates.length === 0 && <li className="text-ink-500">None indexed yet.</li>}
          {candidates.map((c) => {
            const on = attached.has(c.ref);
            return (
              <li key={c.ref} className="flex items-baseline justify-between gap-2 border-b border-line-200 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{c.kind} · w{c.weight}{c.verified ? "" : " · unverified"}</span>
                  <span className="mt-0.5 block truncate">{c.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() => (on ? onRemove(c.ref) : onAttach({ ref: c.ref, label: c.label }))}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950"
                >
                  {on ? "Remove" : "Attach"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Attached sources</h3>
        <ul className="mt-3 space-y-1 text-sm">
          {sources.length === 0 && <li className="text-ink-500">None yet.</li>}
          {sources.map((s) => (
            <li key={s.ref} className="flex items-baseline justify-between gap-2 border-b border-line-200 py-2">
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <button type="button" onClick={() => onRemove(s.ref)} className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-red-600">
                Detach
              </button>
            </li>
          ))}
        </ul>
      </section>

      {showFactCheck && (
        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Ledger fact-check</h3>
            <button
              type="button"
              onClick={run}
              disabled={running || !body}
              className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
            >
              {running ? "Checking…" : "Run"}
            </button>
          </div>
          {!report && <p className="mt-2 text-xs text-ink-500">Extracts numeric claims and matches them against Ledger series values (±5%).</p>}
          {report && (
            <>
              <p className="mt-3 text-xs text-ink-500">
                <span className="text-ink-950">{report.grounded}</span> grounded · <span className="text-ink-950">{report.ungrounded}</span> ungrounded
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {report.claims.map((c, i) => (
                  <li key={i} className="border-b border-line-200 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px]">{c.raw}</span>
                      <span className={c.matches.length > 0 ? "font-mono text-[10px] uppercase tracking-widest text-ink-950" : "font-mono text-[10px] uppercase tracking-widest text-red-600"}>
                        {c.matches.length > 0 ? "grounded" : "unmatched"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">…{c.context}…</p>
                    {c.matches.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-ink-500">
                        {c.matches.slice(0, 2).map((m, j) => (
                          <li key={j} className="font-mono">{m.metric} ({m.unit}) · {m.period} · Δ{m.delta_pct}%</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </aside>
  );
}
