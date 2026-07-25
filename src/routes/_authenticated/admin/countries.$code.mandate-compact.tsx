import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText, Upload, Sparkles, Target, FileCheck, Loader2, Wand2, Building2, AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listMandateCompacts, type CompactRow } from "@/lib/mandate-compact/list.functions";
import { ingestManifesto } from "@/lib/mandate-compact/ingest.functions";
import { getMandateCompactDetail, type CompactDetail } from "@/lib/mandate-compact/detail.functions";
import { decomposeMandateCompact } from "@/lib/mandate-compact/decompose.functions";
import { transformMandateCompact } from "@/lib/mandate-compact/transform.functions";
import {
  upsertDeliverableStatus,
  computeScorecards,
  getPmReportCard,
  type PmReportCard,
  type StatusStatus,
} from "@/lib/mandate-compact/track.functions";
import { cn } from "@/lib/utils";

function compactsQuery(code: string) {
  return queryOptions({
    queryKey: ["mandate-compacts", code],
    queryFn: () => listMandateCompacts({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/mandate-compact")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(compactsQuery(params.code));
  },
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-rose-600">Failed to load Mandate Compact: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-ink-500">Not found.</div>,
  component: MandateCompactPage,
});

const STEPS = [
  { key: "ingest", label: "Ingest", icon: Upload, hint: "Upload the manifesto & seed the second brain" },
  { key: "decompose", label: "Decompose", icon: ScrollText, hint: "AI pillars & pledges" },
  { key: "transform", label: "Transform", icon: Sparkles, hint: "Ministry-owned delivery plan" },
  { key: "track", label: "Track", icon: Target, hint: "Quarterly scorecards" },
] as const;

function MandateCompactPage() {
  const { code } = Route.useParams();
  const { data: compacts } = useSuspenseQuery(compactsQuery(code));
  const [activeStep, setActiveStep] = useState<(typeof STEPS)[number]["key"]>("ingest");
  const [selectedCompactId, setSelectedCompactId] = useState<string | null>(compacts[0]?.id ?? null);
  const selectedCompact = useMemo(
    () => compacts.find((c) => c.id === selectedCompactId) ?? compacts[0] ?? null,
    [compacts, selectedCompactId],
  );

  return (
    <SuperAdminShell
      eyebrow="Chamber 08"
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Mandate Compact" },
      ]}
    >
      <div className="space-y-6 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-ink-900">Mandate Compact · {code}</h1>
          <p className="text-sm text-ink-500">
            The covenant that turns the ruling party's manifesto into a signed, ministry-by-ministry delivery plan.
          </p>
        </header>

        <Stepper active={activeStep} onSelect={setActiveStep} />

        {compacts.length > 0 && activeStep !== "ingest" && (
          <CompactSelector
            compacts={compacts}
            selectedId={selectedCompact?.id ?? null}
            onSelect={setSelectedCompactId}
          />
        )}

        {activeStep === "ingest" && <IngestPanel countryCode={code} compacts={compacts} />}
        {activeStep === "decompose" && (
          selectedCompact
            ? <DecomposePanel countryCode={code} compact={selectedCompact} />
            : <EmptyState body="Ingest a manifesto first, then return here to decompose it." />
        )}
        {activeStep === "transform" && (
          selectedCompact
            ? <TransformPanel countryCode={code} compact={selectedCompact} />
            : <EmptyState body="Ingest and decompose a manifesto first." />
        )}
        {activeStep === "track" && <PhasePlaceholder title="Track" body="Live PM Report Card: on-track / at-risk / off-track by ministry, computed quarterly from status updates. Ships in Slice C." />}

        <CompactList compacts={compacts} />
      </div>
    </SuperAdminShell>
  );
}

function Stepper({ active, onSelect }: { active: string; onSelect: (k: (typeof STEPS)[number]["key"]) => void }) {
  return (
    <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {STEPS.map((step, idx) => {
        const isActive = active === step.key;
        const Icon = step.icon;
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => onSelect(step.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                isActive
                  ? "border-gold-500 bg-paper-0 shadow-sm"
                  : "border-line-200 bg-paper-50 hover:border-line-100",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  isActive ? "bg-gold-500 text-ink-950" : "bg-paper-100 text-ink-500",
                )}
              >
                {idx + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <Icon className="h-4 w-4" /> {step.label}
                </span>
                <span className="mt-1 block text-xs text-ink-500">{step.hint}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function IngestPanel({ countryCode, compacts }: { countryCode: string; compacts: CompactRow[] }) {
  const qc = useQueryClient();
  const ingest = useServerFn(ingestManifesto);
  const [electionCycle, setElectionCycle] = useState("");
  const [title, setTitle] = useState("");
  const [pmName, setPmName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [summary, setSummary] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const mutation = useMutation({
    mutationFn: () =>
      ingest({
        data: {
          countryCode,
          electionCycle: electionCycle.trim(),
          title: title.trim() || undefined,
          pmName: pmName.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          sourceText: sourceText.trim() || undefined,
          summary: summary.trim() || undefined,
          visibility,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.existed
          ? `Compact updated · ${res.chunks_indexed} chunks indexed`
          : `Compact created · ${res.chunks_indexed} chunks indexed`,
      );
      qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
      setSourceText("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disabled = mutation.isPending || !electionCycle.trim() || (!sourceUrl.trim() && !sourceText.trim());

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header>
        <h2 className="text-base font-semibold text-ink-900">Ingest a manifesto</h2>
        <p className="mt-1 text-sm text-ink-500">
          Paste the manifesto URL and/or the full text. We upsert a Compact draft, register the source in the
          country's second brain, and chunk-embed the text so Ask-the-Ledger can quote it verbatim.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Election cycle" required>
          <input
            className="input"
            placeholder="e.g. 2025-2030"
            value={electionCycle}
            onChange={(e) => setElectionCycle(e.target.value)}
          />
        </Field>
        <Field label="Prime Minister">
          <input className="input" value={pmName} onChange={(e) => setPmName(e.target.value)} />
        </Field>
        <Field label="Compact title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${electionCycle || "2025-2030"} Mandate Compact`} />
        </Field>
        <Field label="Visibility">
          <select
            className="input"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "private")}
          >
            <option value="public">Public — visible to all country users & Promise Tracker once signed</option>
            <option value="private">Private — owner country only</option>
          </select>
        </Field>
        <Field label="Manifesto source URL" className="md:col-span-2">
          <input
            className="input"
            placeholder="https://…"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </Field>
        <Field label="Executive summary" className="md:col-span-2">
          <textarea
            className="input min-h-[80px]"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-paragraph elevator pitch of the manifesto (optional)."
          />
        </Field>
        <Field label="Manifesto full text" className="md:col-span-2">
          <textarea
            className="input min-h-[220px] font-mono text-xs"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste the full manifesto text here. We'll chunk and embed it into the country's second brain."
          />
          <p className="mt-1 text-xs text-ink-400">
            {sourceText.length.toLocaleString()} chars ·{" "}
            {sourceText.trim().length > 200 ? "will be chunk-embedded" : "add ≥200 chars to enable corpus ingest"}
          </p>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-100 pt-3">
        <button
          type="button"
          className="btn-primary"
          disabled={disabled}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Ingesting…
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4" /> Create / update Compact
            </>
          )}
        </button>
      </div>

      {compacts.length > 0 && (
        <p className="text-xs text-ink-400">
          {compacts.length} compact{compacts.length === 1 ? "" : "s"} already on file for {countryCode}.
        </p>
      )}
    </section>
  );
}

function CompactList({ compacts }: { compacts: CompactRow[] }) {
  if (!compacts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6 text-center text-sm text-ink-500">
        No Mandate Compacts yet. Start by ingesting the current government's manifesto above.
      </div>
    );
  }
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Compacts on file</h2>
      <ul className="grid gap-3">
        {compacts.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line-200 bg-paper-0 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink-900">{c.title ?? `${c.election_cycle} Compact`}</h3>
                <p className="mt-1 text-xs text-ink-500">
                  {c.pm_name ? `PM ${c.pm_name} · ` : ""}
                  {c.election_cycle} · {c.visibility}
                </p>
              </div>
              <StatusPill status={c.status} />
            </div>
            {c.summary && <p className="mt-2 text-sm text-ink-700">{c.summary}</p>}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink-500">
              <Stat label="Pillars" value={c.pillar_count} />
              <Stat label="Pledges" value={c.pledge_count} />
              <Stat label="Deliverables" value={c.deliverable_count} />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhasePlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </section>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-paper-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "bg-paper-100 text-ink-700",
    signed: "bg-gold-500/20 text-ink-950",
    in_force: "bg-signal-lead/20 text-ink-900",
    concluded: "bg-ink-300 text-ink-50",
    superseded: "bg-ink-300 text-ink-50",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", tone[status] ?? "bg-paper-100 text-ink-700")}>
      {status.replace("_", " ")}
    </span>
  );
}

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
  type Deliverable = CompactDetail["pillars"][number]["pledges"][number]["deliverables"][number];
  const buckets = new Map<string, { ministry: string; items: { pledgeTitle: string; d: Deliverable }[] }>();
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
