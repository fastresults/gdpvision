
function EmptyState({ body }: { body: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6 text-sm text-ink-500">
      {body}
    </section>
  );
}

function CompactSelector({
  compacts,
  selectedId,
  onSelect,
}: {
  compacts: CompactRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-3 rounded-2xl border border-line-200 bg-paper-0 p-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Working on</span>
      <select
        className="input flex-1"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        {compacts.map((c) => (
          <option key={c.id} value={c.id}>
            {(c.title ?? `${c.election_cycle} Compact`) + ` · ${c.status}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function detailQuery(compactId: string) {
  return queryOptions({
    queryKey: ["mandate-compact-detail", compactId],
    queryFn: () => getMandateCompactDetail({ data: { compactId } }),
  });
}

function DecomposePanel({ countryCode, compact }: { countryCode: string; compact: CompactRow }) {
  const qc = useQueryClient();
  const detail = useQuery(detailQuery(compact.id));
  const decompose = useServerFn(decomposeMandateCompact);
  const mutation = useMutation({
    mutationFn: () => decompose({ data: { compactId: compact.id } }),
    onSuccess: (r) => {
      toast.success(`Decomposed · ${r.pillars_created} pillars · ${r.pledges_created} pledges (${r.model})`);
      qc.invalidateQueries({ queryKey: ["mandate-compact-detail", compact.id] });
      qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const d = detail.data;

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Decompose manifesto</h2>
          <p className="mt-1 text-sm text-ink-500">
            AI reads the ingested manifesto text from the second brain and derives 4-8 transformational pillars, each with 3-10 concrete pledges. Idempotent — running again rebuilds the tree.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Decomposing…</>
          ) : (
            <><Wand2 className="h-4 w-4" /> {d?.pillars.length ? "Re-run decompose" : "Run decompose"}</>
          )}
        </button>
      </header>

      {detail.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {d && d.pillars.length === 0 && (
        <EmptyState body="No pillars yet. Run decompose to derive them from the manifesto." />
      )}
      {d && d.pillars.length > 0 && <PillarTree detail={d} />}
    </section>
  );
}

function TransformPanel({ countryCode, compact }: { countryCode: string; compact: CompactRow }) {
  const qc = useQueryClient();
  const detail = useQuery(detailQuery(compact.id));
  const transform = useServerFn(transformMandateCompact);
  const mutation = useMutation({
    mutationFn: () => transform({ data: { compactId: compact.id } }),
    onSuccess: (r) => {
      toast.success(
        `Transformed · ${r.deliverables_created} deliverables (${r.unassigned} unassigned) · ${r.model}`,
      );
      qc.invalidateQueries({ queryKey: ["mandate-compact-detail", compact.id] });
      qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const d = detail.data;
  const pledgeCount = d?.pillars.reduce((s, p) => s + p.pledges.length, 0) ?? 0;
  const delivCount =
    d?.pillars.reduce((s, p) => s + p.pledges.reduce((ss, pl) => ss + pl.deliverables.length, 0), 0) ?? 0;

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Transform into a delivery plan</h2>
          <p className="mt-1 text-sm text-ink-500">
            Assign each pledge to a lead ministry with a McKinsey-grade theory of change, quarterly milestones, and a risk read. Idempotent per compact.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={mutation.isPending || pledgeCount === 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Transforming…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> {delivCount ? "Re-run transform" : "Run transform"}</>
          )}
        </button>
      </header>

      {pledgeCount === 0 && (
        <EmptyState body="No pledges to transform. Run Decompose first." />
      )}
      {d && delivCount > 0 && <DeliverablesByMinistry detail={d} />}
    </section>
  );
}

function PillarTree({ detail }: { detail: CompactDetail }) {
  return (
    <ol className="grid gap-3">
      {detail.pillars.map((p) => (
        <li key={p.id} className="rounded-xl border border-line-100 bg-paper-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink-900">{p.title}</h3>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">
              {p.pledges.length} pledge{p.pledges.length === 1 ? "" : "s"}
            </span>
          </div>
          {p.narrative && <p className="mt-1 text-xs text-ink-500">{p.narrative}</p>}
          <ul className="mt-3 grid gap-2">
            {p.pledges.map((pl) => (
              <li key={pl.id} className="rounded-lg bg-paper-0 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{pl.title}</span>
                  {pl.pledge_type && (
                    <span className="text-[10px] uppercase tracking-wide text-ink-400">{pl.pledge_type}</span>
                  )}
                </div>
                {pl.verbatim_quote && (
                  <blockquote className="mt-1 border-l-2 border-line-200 pl-2 text-xs italic text-ink-500">
                    “{pl.verbatim_quote}”
                  </blockquote>
                )}
                {(pl.baseline_value != null || pl.target_value != null) && (
                  <p className="mt-1 text-xs text-ink-500 tabular-nums">
                    {pl.baseline_value ?? "—"} → {pl.target_value ?? "—"} {pl.unit ?? ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function DeliverablesByMinistry({ detail }: { detail: CompactDetail }) {
  const buckets = new Map<string, { ministry: string; items: { pledgeTitle: string; d: CompactDetail["pillars"][number]["pledges"][number]["deliverables"][number] }[] }>();
  for (const pi of detail.pillars) {
    for (const pl of pi.pledges) {
      for (const d of pl.deliverables) {
        const key = d.lead_ministry_id ?? "unassigned";
        const label = d.lead_ministry_name ?? "Unassigned";
        const bucket = buckets.get(key) ?? { ministry: label, items: [] };
        bucket.items.push({ pledgeTitle: pl.title, d });
        buckets.set(key, bucket);
      }
    }
  }
  const rows = [...buckets.values()].sort((a, b) => (a.ministry === "Unassigned" ? 1 : a.ministry.localeCompare(b.ministry)));

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <details key={row.ministry} className="rounded-xl border border-line-100 bg-paper-50 p-4" open>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink-900">
            <span className="flex items-center gap-2">
              {row.ministry === "Unassigned" ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <Building2 className="h-4 w-4 text-ink-500" />
              )}
              {row.ministry}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">
              {row.items.length} deliverable{row.items.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="mt-3 grid gap-2">
            {row.items.map(({ pledgeTitle, d }) => (
              <li key={d.id} className="rounded-lg bg-paper-0 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{d.title}</span>
                  {d.risk_level && <RiskPill level={d.risk_level} />}
                </div>
                <p className="mt-1 text-xs text-ink-500">Pledge: {pledgeTitle}</p>
                {d.theory_of_change && <p className="mt-2 text-xs text-ink-700">{d.theory_of_change}</p>}
                {d.quarterly_milestones.length > 0 && (
                  <ol className="mt-2 grid gap-1 text-xs text-ink-600">
                    {d.quarterly_milestones.map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-20 shrink-0 font-medium tabular-nums text-ink-500">{m.quarter}</span>
                        <span>{m.target}{m.kpi ? ` · KPI: ${m.kpi}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {d.transformational_note && (
                  <p className="mt-2 rounded-md bg-gold-500/10 px-2 py-1 text-[11px] italic text-ink-700">
                    {d.transformational_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function RiskPill({ level }: { level: string }) {
  const tone: Record<string, string> = {
    low: "bg-signal-lead/20 text-ink-900",
    medium: "bg-gold-500/20 text-ink-950",
    high: "bg-amber-500/25 text-ink-950",
    critical: "bg-rose-500/25 text-ink-950",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tone[level] ?? "bg-paper-100 text-ink-700")}>
      {level}
    </span>
  );
}
