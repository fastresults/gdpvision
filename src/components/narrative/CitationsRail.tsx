import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { factCheckBody } from "@/lib/factcheck.functions";
import { getCitations, listCitationCandidates, saveCitations } from "@/lib/citations.functions";

interface Source { label: string; ref: string }

export function CitationsRail({
  scopeKey,
  sectorCode,
  ownerType,
  ownerId,
  sources,
  onAttach,
  onRemove,
  body,
  showFactCheck = false,
}: {
  scopeKey: string;
  sectorCode?: string;
  ownerType?: "strategy" | "comms" | "counsel";
  ownerId?: string;
  sources: Source[];
  onAttach: (s: Source) => void;
  onRemove: (ref: string) => void;
  body?: string;
  showFactCheck?: boolean;
}) {
  const qc = useQueryClient();
  const persist = useServerFn(saveCitations);
  const persistMut = useMutation({
    mutationFn: (sources: Source[]) =>
      persist({
        data: {
          ownerType: ownerType!,
          ownerId: ownerId!,
          scopeKey,
          sectorCode,
          sources: sources.map((s) => ({ ref: s.ref, label: s.label })),
        },
      }),
    onSuccess: () => {
      if (ownerType && ownerId) {
        qc.invalidateQueries({ queryKey: ["citations-persisted", ownerType, ownerId] });
      }
    },
  });

  const candidatesQuery = queryOptions({
    queryKey: ["citations", scopeKey, sectorCode ?? ""],
    queryFn: () => listCitationCandidates({ data: { scopeKey, sectorCode } }),
  });
  const { data: candidates = [] } = useQuery(candidatesQuery);

  const persistedQuery = queryOptions({
    queryKey: ["citations-persisted", ownerType, ownerId],
    queryFn: () =>
      ownerType && ownerId
        ? getCitations({ data: { ownerType, ownerId } })
        : Promise.resolve([]),
    enabled: !!ownerType && !!ownerId,
  });
  const { data: persisted = [] } = useQuery(persistedQuery);

  const [localSources, setLocalSources] = useState<Source[]>(sources);

  // Hydrate local sources from persisted bindings on first load.
  useEffect(() => {
    const fromDb: Source[] = persisted.map((c) => ({ ref: `memory:${c.memoryObjectId}`, label: c.label }));
    const merged = [...sources];
    for (const s of fromDb) {
      if (!merged.some((m) => m.ref === s.ref)) merged.push(s);
    }
    setLocalSources(merged);
  }, [persisted.length]);

  const attached = new Set(localSources.map((s) => s.ref));

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

  function attach(s: Source) {
    const next = localSources.some((p) => p.ref === s.ref) ? localSources : [...localSources, s];
    setLocalSources(next);
    onAttach(s);
    if (ownerType && ownerId) persistMut.mutate(next);
  }

  function remove(ref: string) {
    const next = localSources.filter((p) => p.ref !== ref);
    setLocalSources(next);
    onRemove(ref);
    if (ownerType && ownerId) persistMut.mutate(next);
  }

  return (
    <aside className="space-y-8">
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Citation candidates</h3>
        <p className="mt-1 text-xs text-ink-500">Second-Brain memory objects for this sector. Suppressed sources are filtered out.</p>
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
                  onClick={() => (on ? remove(c.ref) : attach({ ref: c.ref, label: c.label }))}
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
          {localSources.length === 0 && <li className="text-ink-500">None yet.</li>}
          {localSources.map((s) => (
            <li key={s.ref} className="flex items-baseline justify-between gap-2 border-b border-line-200 py-2">
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <button type="button" onClick={() => remove(s.ref)} className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-red-600">
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
                      <span className={`font-mono text-[10px] uppercase tracking-widest ${
                        c.severity === "green" ? "text-emerald-700" : c.severity === "amber" ? "text-amber-600" : "text-red-600"
                      }`}>
                        {c.severity}
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
