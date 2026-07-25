import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, AlertTriangle, ExternalLink, Loader2, Sparkles } from "lucide-react";

import {
  getCompactMinistriesView,
  type MinistryRollup,
  type MinistryDeliverableView,
} from "@/lib/mandate-compact/ministry.functions";
import { cn } from "@/lib/utils";

type Props = { compactId: string };

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  on_track: { label: "On track", className: "bg-sky-100 text-sky-800 ring-sky-200" },
  at_risk: { label: "At risk", className: "bg-amber-100 text-amber-900 ring-amber-200" },
  off_track: { label: "Off track", className: "bg-orange-100 text-orange-900 ring-orange-200" },
  broken: { label: "Broken", className: "bg-rose-100 text-rose-900 ring-rose-200" },
  unreported: { label: "No update", className: "bg-ink-100 text-ink-700 ring-line-200" },
};

export function MinistriesPanel({ compactId }: Props) {
  const query = useQuery({
    queryKey: ["compact-ministries", compactId],
    queryFn: () => getCompactMinistriesView({ data: { compactId } }),
  });
  const view = query.data;
  const ministries = view?.ministries ?? [];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!ministries.length) return null;
    const key = selectedKey ?? keyOf(ministries[0]);
    return ministries.find((m) => keyOf(m) === key) ?? ministries[0];
  }, [ministries, selectedKey]);

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-line-200 bg-paper-0 p-8 text-center text-sm text-ink-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Loading ministry rollup…
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Failed to load ministry rollup: {(query.error as Error).message}
      </div>
    );
  }
  if (!ministries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-200 bg-paper-0 p-8 text-center text-sm text-ink-500">
        No deliverables yet. Run <em>Transform</em> first — deliverables must be assigned to a lead ministry before the
        drilldown lights up.
      </div>
    );
  }

  const atRisk = ministries.filter((m) => m.weighted_progress < 60 && m.deliverables_reported > 0);

  return (
    <div className="space-y-4">
      <Digest ministries={ministries} atRisk={atRisk} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <aside className="space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Ministries</h3>
          <ul className="space-y-1.5">
            {ministries.map((m) => {
              const k = keyOf(m);
              const isActive = keyOf(selected!) === k;
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(k)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition",
                      isActive
                        ? "border-ink-900 bg-ink-50 shadow-sm"
                        : "border-line-200 bg-paper-0 hover:border-line-100 hover:bg-paper-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                          <Building2 className="h-3.5 w-3.5 text-ink-400" />
                          <span className="truncate">{m.ministry_name}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-ink-500">
                          {m.deliverables_reported}/{m.deliverables_total} reported
                        </div>
                      </div>
                      <ProgressPill value={m.weighted_progress} reported={m.deliverables_reported} />
                    </div>
                    <MiniBar counts={m.counts} total={m.deliverables_total} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {selected ? <MinistryDetail ministry={selected} /> : null}
      </div>
    </div>
  );
}

function Digest({ ministries, atRisk }: { ministries: MinistryRollup[]; atRisk: MinistryRollup[] }) {
  const total = ministries.reduce((s, m) => s + m.deliverables_total, 0);
  const reported = ministries.reduce((s, m) => s + m.deliverables_reported, 0);
  const weakest = ministries[0];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <StatCard
        label="Ministries with deliverables"
        value={ministries.length.toString()}
        hint={`${reported}/${total} deliverables reported`}
      />
      <StatCard
        label="At-risk ministries"
        value={atRisk.length.toString()}
        hint={atRisk.length ? "Weighted progress < 60%" : "All reporting ministries above 60%"}
        tone={atRisk.length > 0 ? "warn" : "ok"}
      />
      <StatCard
        label="Weakest ministry"
        value={weakest?.ministry_name ?? "—"}
        hint={weakest ? `${weakest.weighted_progress.toFixed(1)}% weighted progress` : "—"}
        tone={weakest && weakest.weighted_progress < 40 ? "bad" : "neutral"}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50/60"
      : tone === "bad"
      ? "border-rose-200 bg-rose-50/60"
      : "border-line-200 bg-paper-0";
  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-ink-900">{value}</div>
      <div className="mt-0.5 text-xs text-ink-500">{hint}</div>
    </div>
  );
}

function MiniBar({
  counts,
  total,
}: {
  counts: MinistryRollup["counts"];
  total: number;
}) {
  const denom = total || 1;
  const seg = (n: number) => `${(n / denom) * 100}%`;
  return (
    <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line-200">
      <span style={{ width: seg(counts.delivered) }} className="bg-emerald-500" />
      <span style={{ width: seg(counts.on_track) }} className="bg-sky-500" />
      <span style={{ width: seg(counts.at_risk) }} className="bg-amber-500" />
      <span style={{ width: seg(counts.off_track) }} className="bg-orange-500" />
      <span style={{ width: seg(counts.broken) }} className="bg-rose-500" />
      <span style={{ width: seg(counts.unreported) }} className="bg-ink-300" />
    </div>
  );
}

function ProgressPill({ value, reported }: { value: number; reported: number }) {
  if (reported === 0) {
    return (
      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600 ring-1 ring-line-200">
        No data
      </span>
    );
  }
  const tone =
    value >= 80
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : value >= 60
      ? "bg-sky-100 text-sky-800 ring-sky-200"
      : value >= 40
      ? "bg-amber-100 text-amber-900 ring-amber-200"
      : "bg-rose-100 text-rose-900 ring-rose-200";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 tabular-nums", tone)}>
      {value.toFixed(1)}%
    </span>
  );
}

function MinistryDetail({ ministry }: { ministry: MinistryRollup }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{ministry.ministry_name}</h3>
          <p className="text-sm text-ink-500">
            {ministry.deliverables_total} deliverable{ministry.deliverables_total === 1 ? "" : "s"} ·{" "}
            {ministry.deliverables_reported} reported · weighted progress{" "}
            <span className="font-semibold text-ink-900">{ministry.weighted_progress.toFixed(1)}%</span>
          </p>
        </div>
        <ProgressPill value={ministry.weighted_progress} reported={ministry.deliverables_reported} />
      </header>

      {ministry.at_risk_titles.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs the PM's attention
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {ministry.at_risk_titles.slice(0, 6).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : ministry.deliverables_reported > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
          <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Nothing at risk in the latest reporting cycle.
        </div>
      ) : null}

      <ul className="divide-y divide-line-100 rounded-xl border border-line-200">
        {ministry.deliverables.map((d) => (
          <DeliverableRow key={d.deliverable_id} d={d} />
        ))}
      </ul>
    </section>
  );
}

function DeliverableRow({ d }: { d: MinistryDeliverableView }) {
  const style = STATUS_STYLE[d.latest_status ?? "unreported"] ?? STATUS_STYLE.unreported;
  return (
    <li className="space-y-1.5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-ink-500">
            {d.pillar_title} · {d.pledge_title}
          </div>
          <div className="text-sm font-medium text-ink-900">{d.deliverable_title}</div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", style.className)}>
          {style.label}
          {d.latest_period ? <span className="ml-1 opacity-70">· {d.latest_period}</span> : null}
        </span>
      </div>
      {d.latest_narrative ? <p className="text-sm text-ink-700">{d.latest_narrative}</p> : null}
      {d.latest_evidence_url ? (
        <a
          href={d.latest_evidence_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900"
        >
          <ExternalLink className="h-3 w-3" /> Evidence
        </a>
      ) : null}
    </li>
  );
}

function keyOf(m: MinistryRollup) {
  return m.ministry_id ?? "__unassigned__";
}
