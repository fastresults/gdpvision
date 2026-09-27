import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Explain } from "@/components/explain/Explain";
import {
  checklist,
  draftScorecard,
  getSetupContext,
  saveSetupSession,
  submitScorecard,
  type Proposal,
  type SetupDraft,
} from "@/lib/portfolio/scorecard-setup.functions";
import "@/lib/explain/portfolio-entries";
import { useUrlState } from "@/lib/nav/url-state";

const STEPS = ["Context", "AI proposal", "Review", "Actuals", "Submit"] as const;

export function KpiSetupModal({
  code,
  ministrySlug,
  onClose,
}: {
  code: string;
  ministrySlug: string | null;
  onClose: () => void;
}) {
  const open = !!ministrySlug;
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getSetupContext);
  const draftFn = useServerFn(draftScorecard);
  const saveFn = useServerFn(saveSetupSession);
  const submitFn = useServerFn(submitScorecard);

  const ctxQ = useQuery({
    queryKey: ["kpi-setup", code, ministrySlug],
    queryFn: () => fetchCtx({ data: { countryCode: code, ministrySlug: ministrySlug! } }),
    enabled: open,
  });
  const ctx = ctxQ.data;

  const [stepStr, setStepStr] = useUrlState<string>("sstep", "1");
  const [, replaceStepStr] = useUrlState<string>("sstep", "1", { replace: true });
  const step = Math.max(1, Math.min(5, Number(stepStr) || 1));
  const setStep = (n: number) => setStepStr(String(n));
  const [draft, setDraft] = useState<SetupDraft>({ proposals: [] });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    if (ctx.session?.draft?.proposals) {
      setDraft(ctx.session.draft);
      if (step === 1) replaceStepStr(String(ctx.session.status === "submitted" ? 5 : Math.max(1, Math.min(4, ctx.session.step))));
    } else {
      setDraft({ proposals: [] });
    }
  }, [ctx]);

  async function persist(nextStep: number, d = draft) {
    if (!ctx) return;
    setStep(nextStep);
    try {
      await saveFn({ data: { countryCode: code, ministryId: ctx.ministry.id, step: nextStep, draft: d } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save progress");
    }
  }

  async function runDraft() {
    setBusy("draft");
    try {
      const d = await draftFn({ data: { countryCode: code, ministrySlug: ministrySlug! } });
      setDraft(d);
      setStep(3);
      if (!d.proposals.length) toast.message("The AI found no defensible KPIs from the data on file.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!ctx) return;
    setBusy("submit");
    try {
      const r = await submitFn({ data: { countryCode: code, ministryId: ctx.ministry.id, step: 5, draft } });
      toast.success(`${r.saved} KPI${r.saved === 1 ? "" : "s"} sent for second-person qualification`);
      await qc.invalidateQueries({ queryKey: ["portfolio-delivery-kpis", code] });
      await ctxQ.refetch();
      setStep(5);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(null);
    }
  }

  function patch(key: string, p: Partial<Proposal>) {
    setDraft((d) => ({ ...d, proposals: d.proposals.map((x) => (x.key === key ? { ...x, ...p } : x)) }));
  }
  function addBlank() {
    const sector = ctx?.sectors[0]?.code ?? "ALL";
    setDraft((d) => ({
      ...d,
      proposals: [
        ...d.proposals,
        {
          key: `m-${Date.now()}`,
          metric: "",
          unit: "",
          sector_code: sector,
          source_kpi_code: null,
          direction: "up",
          baseline: null,
          baseline_period: "",
          target: 0,
          target_period: String(new Date().getUTCFullYear() + 2),
          target_basis: "policy_commitment",
          cadence: "annual",
          warning_tolerance_pct: 10,
          critical_tolerance_pct: 20,
          evidence_url: "",
          rationale: "Added manually.",
          peer_median: null,
          inferred: false,
          checks: [],
          decision: "accepted",
          actual: null,
          actual_period: "",
        },
      ],
    }));
  }

  const accepted = draft.proposals.filter((p) => p.decision === "accepted");
  const blocked = accepted.filter((p) => checklist(p).length > 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-paper-0 sm:max-w-2xl">
        <SheetHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            {code} · Delivery scorecard setup
          </p>
          <SheetTitle className="font-serif text-2xl text-ink-950">
            {ctx?.ministry.name ?? "Loading…"}
          </SheetTitle>
          <SheetDescription className="text-ink-500">
            AI drafts from this country’s data. People review, and a second authorised person qualifies.
          </SheetDescription>
        </SheetHeader>

        <ol className="mt-4 flex flex-wrap gap-1">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => ctx && (i + 1 <= 2 || draft.proposals.length) && setStep(i + 1)}
                className={
                  "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] " +
                  (step === i + 1 ? "border-ink-950 text-ink-950" : "border-line-200 text-ink-500")
                }
              >
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>

        {ctxQ.isLoading && <p className="mt-8 text-sm text-ink-500">Gathering context…</p>}
        {ctxQ.error && <p className="mt-8 text-sm text-red-700">{(ctxQ.error as Error).message}</p>}

        {ctx && step === 1 && (
          <section className="mt-6 space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Minister" value={ctx.minister ?? "Not on record"} />
              <Fact label="GDP exposure" value={ctx.gdpExposure ? `${ctx.gdpExposure.toFixed(1)}%` : "—"} />
              <Fact label="Mapped sectors" value={ctx.sectors.map((s) => s.code).join(", ") || "None"} />
              <Fact label="National indicators" value={String(ctx.indicators.length)} />
              <Fact label="Existing KPIs" value={String(ctx.existing.length)} />
              <Fact
                label="With targets"
                value={String(ctx.indicators.filter((i) => i.target != null).length)}
              />
            </dl>
            {ctx.gaps.length > 0 && (
              <div className="border border-line-200 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Data gaps</p>
                <ul className="mt-2 list-disc pl-5 text-ink-700">
                  {ctx.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => persist(2)}>
                Continue
              </button>
            </div>
          </section>
        )}

        {ctx && step === 2 && (
          <section className="mt-6 space-y-4 text-sm">
            <p className="text-ink-700">
              The AI will propose 3–6 KPIs using only the indicators, sectors and mandate on file. Every
              baseline is checked against stored figures; anything it cannot link to a source is labelled
              <strong> Inferred</strong> and cannot be approved until someone confirms it.
            </p>
            {draft.proposals.length > 0 && (
              <p className="text-ink-500">Running again replaces the current draft proposals.</p>
            )}
            <div className="flex justify-between">
              <button type="button" className="btn-ghost" onClick={() => { addBlank(); persist(3); }}>
                Write my own instead
              </button>
              <button type="button" className="btn-primary" disabled={!!busy} onClick={runDraft}>
                {busy === "draft" ? "Drafting…" : "Draft scorecard"}
              </button>
            </div>
          </section>
        )}

        {ctx && step === 3 && (
          <section className="mt-6 space-y-4">
            {draft.aiNote && <p className="text-xs text-ink-500">AI note: {draft.aiNote}</p>}
            {draft.proposals.map((p) => (
              <ProposalCard key={p.key} p={p} sectors={ctx.sectors.map((s) => s.code)} onChange={(v) => patch(p.key, v)} />
            ))}
            <button type="button" className="btn-ghost" onClick={addBlank}>
              + Add KPI manually
            </button>
            <div className="flex justify-between">
              <button type="button" className="btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn-primary" disabled={!accepted.length} onClick={() => persist(4)}>
                Continue with {accepted.length} accepted
              </button>
            </div>
          </section>
        )}

        {ctx && step === 4 && (
          <section className="mt-6 space-y-3 text-sm">
            <p className="text-ink-700">Latest readings are pre-filled from the country’s data. Correct or add them.</p>
            {accepted.map((p) => (
              <div key={p.key} className="grid grid-cols-[1fr_110px_110px] items-center gap-2 border-b border-line-200 pb-2">
                <span className="text-ink-950">{p.metric}</span>
                <input
                  aria-label="Actual value"
                  type="number"
                  className="border border-line-200 bg-transparent px-2 py-1 text-right tabular-nums"
                  value={p.actual ?? ""}
                  onChange={(e) => patch(p.key, { actual: e.target.value === "" ? null : Number(e.target.value) })}
                />
                <input
                  aria-label="Period"
                  placeholder="e.g. 2025"
                  className="border border-line-200 bg-transparent px-2 py-1"
                  value={p.actual_period}
                  onChange={(e) => patch(p.key, { actual_period: e.target.value })}
                />
              </div>
            ))}
            <div className="flex justify-between">
              <button type="button" className="btn-ghost" onClick={() => setStep(3)}>Back</button>
              <button type="button" className="btn-primary" onClick={() => persist(5)}>Continue</button>
            </div>
          </section>
        )}

        {ctx && step === 5 && (
          <section className="mt-6 space-y-4 text-sm">
            {ctx.session?.status === "submitted" && (
              <p className="border border-line-200 p-3 text-ink-700">
                Submitted. These KPIs now wait in the Delivery scorecards queue for a second authorised person.
                You can edit and resubmit anything not yet qualified.
              </p>
            )}
            <ul className="space-y-1">
              {accepted.map((p) => {
                const miss = checklist(p);
                return (
                  <li key={p.key} className="flex justify-between gap-3 border-b border-line-200 py-1">
                    <span>{p.metric}</span>
                    <span className={miss.length ? "text-red-700" : "text-emerald-700"}>
                      {miss.length ? `Missing: ${miss.join(", ")}` : p.inferred ? "Ready · Inferred" : "Ready"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between">
              <button type="button" className="btn-ghost" onClick={() => setStep(3)}>Edit KPIs</button>
              <button type="button" className="btn-primary" disabled={!!busy || !accepted.length || blocked.length > 0} onClick={submit}>
                {busy === "submit" ? "Submitting…" : "Submit for qualification"}
              </button>
            </div>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-200 p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{label}</dt>
      <dd className="mt-1 text-ink-950">{value}</dd>
    </div>
  );
}

function ProposalCard({
  p,
  sectors,
  onChange,
}: {
  p: Proposal;
  sectors: string[];
  onChange: (v: Partial<Proposal>) => void;
}) {
  const miss = checklist(p);
  const inp = "w-full border border-line-200 bg-transparent px-2 py-1 text-sm";
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <div
      className={
        "border p-3 " + (p.decision === "rejected" ? "border-line-200 opacity-50" : p.decision === "accepted" ? "border-ink-950" : "border-line-200")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <input className={inp + " font-medium"} value={p.metric} placeholder="KPI name" onChange={(e) => onChange({ metric: e.target.value })} />
        {p.inferred && (
          <span className="shrink-0 border border-line-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">Inferred</span>
        )}
      </div>
      <Explain id="portfolio.scorecard-proposal" ctx={p}>
        <p className="mt-2 text-xs text-ink-500">{p.rationale}</p>
      </Explain>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <L t="Unit"><input className={inp} value={p.unit} onChange={(e) => onChange({ unit: e.target.value })} /></L>
        <L t="Sector">
          <select className={inp} value={p.sector_code} onChange={(e) => onChange({ sector_code: e.target.value })}>
            {[...new Set([p.sector_code, ...sectors])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </L>
        <L t="Direction">
          <select className={inp} value={p.direction} onChange={(e) => onChange({ direction: e.target.value as Proposal["direction"] })}>
            <option value="up">Higher is better</option>
            <option value="down">Lower is better</option>
            <option value="flat">Hold at target</option>
          </select>
        </L>
        <L t="Cadence">
          <select className={inp} value={p.cadence} onChange={(e) => onChange({ cadence: e.target.value as Proposal["cadence"] })}>
            <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
          </select>
        </L>
        <L t="Baseline"><input type="number" className={inp + " text-right"} value={p.baseline ?? ""} onChange={(e) => onChange({ baseline: num(e.target.value) })} /></L>
        <L t="Baseline period"><input className={inp} value={p.baseline_period} onChange={(e) => onChange({ baseline_period: e.target.value })} /></L>
        <L t="Target"><input type="number" className={inp + " text-right"} value={Number.isFinite(p.target) ? p.target : ""} onChange={(e) => onChange({ target: Number(e.target.value) })} /></L>
        <L t="Target period"><input className={inp} value={p.target_period} onChange={(e) => onChange({ target_period: e.target.value })} /></L>
        <L t="Target basis">
          <select className={inp} value={p.target_basis} onChange={(e) => onChange({ target_basis: e.target.value as Proposal["target_basis"] })}>
            <option value="policy_commitment">Policy commitment</option>
            <option value="peer_benchmark">Peer benchmark</option>
            <option value="approved_scenario">Approved scenario</option>
          </select>
        </L>
        <L t="Warning %"><input type="number" className={inp + " text-right"} value={p.warning_tolerance_pct} onChange={(e) => onChange({ warning_tolerance_pct: Number(e.target.value) })} /></L>
        <L t="Critical %"><input type="number" className={inp + " text-right"} value={p.critical_tolerance_pct} onChange={(e) => onChange({ critical_tolerance_pct: Number(e.target.value) })} /></L>
        <L t="Peer median"><span className="block px-2 py-1 text-right text-sm tabular-nums text-ink-500">{p.peer_median?.toFixed(2) ?? "—"}</span></L>
      </div>
      <L t="Evidence link">
        <input className={inp} value={p.evidence_url} placeholder="https://…" onChange={(e) => onChange({ evidence_url: e.target.value })} />
      </L>
      {p.checks.length > 0 && (
        <ul className="mt-2 text-xs text-ink-500">{p.checks.map((c) => <li key={c}>· {c}</li>)}</ul>
      )}
      {p.decision === "accepted" && miss.length > 0 && (
        <p className="mt-2 text-xs text-red-700">Missing: {miss.join(", ")}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className={p.decision === "accepted" ? "btn-primary" : "btn-secondary"} onClick={() => onChange({ decision: "accepted" })}>Accept</button>
        <button type="button" className="btn-ghost" onClick={() => onChange({ decision: "rejected" })}>Reject</button>
        {p.inferred && (
          <button type="button" className="btn-ghost" onClick={() => onChange({ inferred: false, checks: [...p.checks, "Figures confirmed by preparer."] })}>
            I confirmed these figures
          </button>
        )}
      </div>
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block">
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">{t}</span>
      {children}
    </label>
  );
}
