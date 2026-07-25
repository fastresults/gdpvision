import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText, Upload, Sparkles, Target, FileCheck, Loader2 } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listMandateCompacts, type CompactRow } from "@/lib/mandate-compact/list.functions";
import { ingestManifesto } from "@/lib/mandate-compact/ingest.functions";
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

  return (
    <SuperAdminShell
      title="Mandate Compact"
      subtitle={`${code} · Chamber 08 — the covenant that turns the ruling party's manifesto into a signed, ministry-by-ministry delivery plan.`}
    >
      <div className="space-y-6 p-4 sm:p-6">
        <Stepper active={activeStep} onSelect={setActiveStep} />

        {activeStep === "ingest" && <IngestPanel countryCode={code} compacts={compacts} />}
        {activeStep === "decompose" && <PhasePlaceholder title="Decompose" body="Auto-derive pillars, pledges and quantitative anchors from the ingested manifesto. Ships in Slice B." />}
        {activeStep === "transform" && <PhasePlaceholder title="Transform" body="Assign each pledge to a lead ministry with a McKinsey-grade transformation brief and quarterly milestones. Ships in Slice B." />}
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
