// Chamber 07 · Research Studio Wizard — modal shell with 5 steps + one-click Auto-run.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ArrowRight, Sparkles, Check, Loader2, FileText, BookOpen, Users, ClipboardList, Rocket, Wand2 } from "lucide-react";

import {
  createDraft, getDraft, saveDraft, enrichBrief, enrichOutcome, retryOutcomeAi,
  listDeliverables, draftCast, commitStudy,
} from "@/lib/personas/wizard.functions";
import { MultimodalInput, type WizardUpload } from "./MultimodalInput";
import { PrettyJson } from "@/components/data/PrettyJson";
import { AutoRunConsole } from "./AutoRunConsole";

type Step = "brief" | "outcome" | "cast" | "preview" | "launch";
const STEPS: { id: Step; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "brief",   label: "Brief",     icon: FileText },
  { id: "outcome", label: "Outcome",   icon: BookOpen },
  { id: "cast",    label: "Cast",      icon: Users },
  { id: "preview", label: "Preview",   icon: ClipboardList },
  { id: "launch",  label: "Launch",    icon: Rocket },
];

type Props = {
  open: boolean;
  onClose: () => void;
  countryCode: string;
  draftId?: string;
  initialAutorun?: boolean;
};

export function StudyWizardModal({ open, onClose, countryCode, draftId: initialDraftId, initialAutorun }: Props) {
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  const [step, setStep] = useState<Step>("brief");
  const [autorun, setAutorun] = useState<boolean>(!!initialAutorun);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Ensure a draft exists.
  useEffect(() => {
    if (!open) return;
    if (draftId) return;
    (async () => {
      const { id } = await createDraft({ data: { countryCode } });
      setDraftId(id);
    })();
  }, [open, draftId, countryCode]);

  const draftQ = useQuery({
    queryKey: ["study-draft", draftId],
    queryFn: () => getDraft({ data: { id: draftId! } }),
    enabled: !!draftId && open,
  });

  useEffect(() => {
    if (!autorun && draftQ.data?.step) setStep(draftQ.data.step as Step);
  }, [draftQ.data?.step, autorun]);

  const refreshDraft = () => qc.invalidateQueries({ queryKey: ["study-draft", draftId] });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink-950/70 backdrop-blur-sm p-2 sm:p-6">
      <div className="relative flex w-full max-w-6xl overflow-hidden border border-line-200 bg-paper-0 shadow-2xl">
        {/* Left rail */}
        <aside className="hidden w-56 shrink-0 border-r border-line-200 bg-paper-50 p-5 md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Chamber 07</p>
          <h3 className="mt-1 font-serif text-lg leading-tight text-ink-950">Research Studio</h3>
          <ol className="mt-6 space-y-1.5">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const done = STEPS.findIndex((x) => x.id === step) > i;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left text-[12px] transition ${
                      active
                        ? "border-ink-950 bg-ink-950 text-paper-0"
                        : done
                          ? "border-line-200 bg-paper-0 text-ink-700 hover:border-ink-500"
                          : "border-transparent text-ink-500 hover:border-line-200"
                    }`}
                  >
                    <s.icon size={13} className="shrink-0" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{`0${i + 1}`}</span>
                    <span className="font-serif">{s.label}</span>
                    {done && <Check size={12} className="ml-auto opacity-60" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Body */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line-200 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                {countryCode} · Study wizard
              </p>
              <h2 className="mt-0.5 truncate font-serif text-lg text-ink-950">
                {draftQ.data?.title ?? "New research study"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (draftId) {
                    try { await saveDraft({ data: { id: draftId, patch: { step } } }); } catch { /* noop */ }
                  }
                  onClose();
                }}
                className="hidden sm:inline-flex items-center gap-1 border border-line-200 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
              >
                Save &amp; close
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-ink-500 hover:bg-paper-50 hover:text-ink-950"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

          </header>

          <div className="flex-1 overflow-y-auto p-5 sm:p-7">
            {!draftId || draftQ.isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-500">
                <Loader2 size={14} className="mr-2 animate-spin" /> Preparing wizard…
              </div>
            ) : autorun ? (
              <AutoRunConsole
                draftId={draftId}
                countryCode={countryCode}
                onDone={(studyId) => {
                  onClose();
                  navigate({ to: "/admin/countries/$code/personas/studies/$id", params: { code: countryCode, id: studyId } });
                }}
                onCancel={() => { setAutorun(false); refreshDraft(); }}
              />
            ) : (
              <>
                {step === "brief"   && <StepBrief   draftId={draftId} countryCode={countryCode} draft={draftQ.data!} onNext={() => { setStep("outcome"); refreshDraft(); }} onSaved={refreshDraft} onAutoRun={() => setAutorun(true)} />}
                {step === "outcome" && <StepOutcome draftId={draftId} countryCode={countryCode} draft={draftQ.data!} onNext={() => { setStep("cast"); refreshDraft(); }} />}
                {step === "cast"    && <StepCast    draftId={draftId} countryCode={countryCode} draft={draftQ.data!} onNext={() => { setStep("preview"); refreshDraft(); }} />}
                {step === "preview" && <StepPreview draft={draftQ.data!} onNext={() => setStep("launch")} onBack={() => setStep("cast")} />}
                {step === "launch"  && <StepLaunch  draftId={draftId} countryCode={countryCode} onDone={(studyId) => {
                  onClose();
                  navigate({ to: "/admin/countries/$code/personas/studies/$id", params: { code: countryCode, id: studyId } });
                }} />}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Step 1: Brief ────────────────────────────────────────────────────────

type DraftShape = {
  id: string; title: string | null; step: string;
  brief_raw: string | null; brief_scope: unknown;
  outcome_raw: string | null; outcome_blueprint: unknown;
  cast_draft: unknown; uploads: unknown;
};

function StepBrief({ draftId, countryCode, draft, onNext, onSaved, onAutoRun }: {
  draftId: string; countryCode: string; draft: DraftShape; onNext: () => void; onSaved: () => void; onAutoRun: () => void;
}) {
  const [text, setText] = useState(draft.brief_raw ?? "");
  const [uploads, setUploads] = useState<WizardUpload[]>(Array.isArray(draft.uploads) ? (draft.uploads as WizardUpload[]) : []);
  const [autoRunHint, setAutoRunHint] = useState<string | null>(null);
  const scope = draft.brief_scope as {
    title?: string; objectives?: string[]; hypotheses?: string[]; decisions?: string[];
    stakeholders?: { name: string; type: string; role: string }[]; timeframe?: string;
    geography?: string; sensitivities?: string[]; success_criteria?: string[];
  } | null;

  // Autosave brief_raw + uploads
  useEffect(() => {
    const t = setTimeout(() => {
      saveDraft({ data: { id: draftId, patch: { brief_raw: text, uploads } } }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [draftId, text, uploads]);

  const enrich = useMutation({
    mutationFn: async () => {
      const combined = [
        text.trim(),
        ...uploads.filter((u) => u.excerpt).map((u) => `\n\n[UPLOAD: ${u.name}]\n${u.excerpt}`),
      ].join("").trim();
      if (combined.length < 3) throw new Error("Add a brief first.");
      return enrichBrief({ data: { draftId, countryCode, raw: combined.slice(0, 20000) } });
    },
    onSuccess: () => onSaved(),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="font-serif text-xl text-ink-950">Capture the brief</h3>
        <p className="mt-1 text-sm text-ink-500">
          Type it, dictate it, or upload the source document — the AI will merge everything into a Research Scope.
        </p>
        <div className="mt-4">
          <MultimodalInput
            countryCode={countryCode}
            value={text}
            onChange={setText}
            onUpload={(u) => setUploads((prev) => [...prev, u])}
            uploads={uploads}
            placeholder="What are you trying to learn, decide, or defend? Who does it affect? What changed?"
            rows={10}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              // Persist any pending brief edits before auto-run kicks off.
              try { await saveDraft({ data: { id: draftId, patch: { brief_raw: text, uploads } } }); } catch { /* ignore */ }
              onAutoRun();
            }}
            disabled={!text.trim() && uploads.length === 0}
            className="inline-flex items-center gap-1.5 border border-emerald-700 bg-emerald-700 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-emerald-800 disabled:opacity-40"
            title="Enrich brief → blueprint deliverables → cast personas → commit → synthesize, in one run."
          >
            <Wand2 size={12} /> Auto-run full study
          </button>
          <button
            type="button"
            onClick={() => enrich.mutate()}
            disabled={enrich.isPending}
            className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
          >
            {enrich.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {enrich.isPending ? "Enriching…" : scope ? "Re-enrich" : "Enrich into Research Scope"}
          </button>
          {scope && (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:border-ink-950"
            >
              Continue <ArrowRight size={12} />
            </button>
          )}
          {enrich.isError && (
            <span className="text-[11px] text-rose-600">{(enrich.error as Error).message}</span>
          )}
        </div>
      </div>

      <div className="border-l border-line-200 pl-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">AI · Research Scope</p>
        {!scope ? (
          <div className="mt-2 border border-dashed border-line-200 p-6 text-[12px] text-ink-500">
            The enriched scope will appear here — objectives, hypotheses, decisions, stakeholders, timeframe, sensitivities, success criteria.
          </div>
        ) : (
          <div className="mt-3 space-y-4 text-[12px] leading-relaxed">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Title</p>
              <p className="mt-1 font-serif text-base text-ink-950">{scope.title}</p>
            </div>
            <ScopeList label="Objectives" items={scope.objectives} />
            <ScopeList label="Hypotheses" items={scope.hypotheses} />
            <ScopeList label="Decisions this must inform" items={scope.decisions} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Stakeholders</p>
              <ul className="mt-1 space-y-1">
                {(scope.stakeholders ?? []).map((s, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${s.type === "internal" ? "bg-ink-950 text-paper-0" : "border border-ink-950 text-ink-950"}`}>{s.type}</span>
                    <span className="font-medium text-ink-950">{s.name}</span>
                    <span className="text-ink-500">— {s.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ScopeField label="Timeframe" value={scope.timeframe} />
              <ScopeField label="Geography" value={scope.geography} />
            </div>
            <ScopeList label="Sensitivities" items={scope.sensitivities} />
            <ScopeList label="Success criteria" items={scope.success_criteria} />
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-700">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
function ScopeField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{label}</p>
      <p className="mt-0.5 text-ink-700">{value ?? "—"}</p>
    </div>
  );
}

// ─── Step 2: Outcome ──────────────────────────────────────────────────────

function StepOutcome({ draftId, countryCode, draft, onNext }: {
  draftId: string; countryCode: string; draft: DraftShape; onNext: () => void;
}) {
  const [text, setText] = useState(draft.outcome_raw ?? "");
  const [tone, setTone] = useState<"cabinet" | "investor" | "public">("cabinet");
  const [selected, setSelected] = useState<string[]>(
    (draft.outcome_blueprint as { deliverables?: { code: string }[] } | null)?.deliverables?.map((d) => d.code) ?? [],
  );
  const [uploads, setUploads] = useState<WizardUpload[]>([]);
  const [phase, setPhase] = useState<"idle" | "scaffolding" | "enriching" | "finalizing">("idle");
  const qc = useQueryClient();
  const lib = useQuery({ queryKey: ["deliverables"], queryFn: () => listDeliverables() });
  const blueprint = draft.outcome_blueprint as {
    tone?: string;
    deliverables?: { code: string; label: string; sections: string[]; evidence_density: string; length_hint: string }[];
    ai_status?: "enriched" | "repaired" | "fallback" | "scaffold_only";
    ai_model?: string;
    ai_run_id?: string;
    ai_raw_excerpt?: string;
    ai_error?: string;
  } | null;

  const runPhases = () => {
    setPhase("scaffolding");
    const t1 = setTimeout(() => setPhase("enriching"), 400);
    const t2 = setTimeout(() => setPhase("finalizing"), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  };

  const enrich = useMutation({
    mutationFn: async () => {
      if (selected.length === 0) throw new Error("Pick at least one deliverable.");
      const combined = [text.trim(), ...uploads.map((u) => `\n[UPLOAD ${u.name}]\n${u.excerpt ?? ""}`)].join("").trim();
      const cleanup = runPhases();
      try {
        return await enrichOutcome({ data: { draftId, countryCode, raw: combined || undefined, selectedCodes: selected, tone } });
      } finally {
        cleanup();
        setPhase("idle");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-draft", draftId] }),
  });

  const retry = useMutation({
    mutationFn: async () => {
      const cleanup = runPhases();
      try { return await retryOutcomeAi({ data: { draftId } }); }
      finally { cleanup(); setPhase("idle"); }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-draft", draftId] }),
  });

  const busy = enrich.isPending || retry.isPending;
  const phaseLabel =
    phase === "scaffolding" ? "Building scaffold…" :
    phase === "enriching" ? "Enriching with AI…" :
    phase === "finalizing" ? "Finalizing…" : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="font-serif text-xl text-ink-950">Define the output</h3>
        <p className="mt-1 text-sm text-ink-500">
          Choose McKinsey-style deliverables. Optionally dictate or upload a template you want us to match.
        </p>

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Tone</p>
          <div className="mt-1 flex gap-2">
            {(["cabinet", "investor", "public"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)}
                className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${tone === t ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 text-ink-700 hover:border-ink-950"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Deliverables</p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(lib.data ?? []).map((d) => {
              const on = selected.includes(d.code);
              return (
                <button key={d.code} type="button"
                  onClick={() => setSelected((prev) => on ? prev.filter((x) => x !== d.code) : [...prev, d.code])}
                  className={`border p-2.5 text-left transition ${on ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 hover:border-ink-950"}`}>
                  <p className="font-serif text-sm">{d.label}</p>
                  <p className={`mt-0.5 text-[11px] ${on ? "text-paper-0/70" : "text-ink-500"}`}>{d.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Extra guidance (optional)</p>
          <div className="mt-1">
            <MultimodalInput countryCode={countryCode} value={text} onChange={setText}
              onUpload={(u) => setUploads((p) => [...p, u])} uploads={uploads}
              placeholder="e.g. Match this deck's structure, keep to 10 slides, cite EU AML guidance…" rows={4} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => enrich.mutate()} disabled={busy || selected.length === 0}
            className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {busy ? (phaseLabel || "Working…") : blueprint ? "Rebuild blueprint" : "Build deliverable blueprint"}
          </button>
          {blueprint?.deliverables?.length ? (
            <button type="button" onClick={onNext}
              className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:border-ink-950">
              Continue <ArrowRight size={12} />
            </button>
          ) : null}
          {enrich.isError && (
            <span className="text-[11px] text-rose-600">{(enrich.error as Error).message}</span>
          )}
        </div>
      </div>

      <div className="border-l border-line-200 pl-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">AI · Deliverable blueprint</p>
          {blueprint?.ai_status && <StatusChip status={blueprint.ai_status} />}
        </div>
        {!blueprint?.deliverables?.length ? (
          <div className="mt-2 border border-dashed border-line-200 p-6 text-[12px] text-ink-500">
            Pick deliverables, then build to see sections, evidence density, and length hints.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {blueprint.ai_status === "scaffold_only" && (
              <div className="border border-amber-400 bg-amber-50 p-3 text-[12px] text-ink-800">
                <p className="font-medium text-ink-950">AI enrichment didn't land — showing structural scaffold.</p>
                <p className="mt-1 text-ink-700">
                  Sections below come from the deterministic McKinsey template library. Retry to layer AI-tuned sections, evidence density, and length hints for your scope.
                </p>
                <button
                  type="button"
                  onClick={() => retry.mutate()}
                  disabled={busy}
                  className="mt-2 inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
                >
                  {retry.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  Retry AI enrichment
                </button>
              </div>
            )}
            {blueprint.deliverables.map((d) => (
              <div key={d.code} className="border border-line-200 bg-paper-50 p-3">
                <div className="flex items-baseline justify-between">
                  <p className="font-serif text-sm text-ink-950">{d.label}</p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                    {d.evidence_density} evidence · {d.length_hint}
                  </span>
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-ink-700">
                  {d.sections?.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            ))}
            {(blueprint.ai_error || blueprint.ai_raw_excerpt || blueprint.ai_run_id) && (
              <details className="border border-line-200 bg-paper-0">
                <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950">
                  Debug · AI provenance
                </summary>
                <div className="border-t border-line-200 p-3">
                  <PrettyJson
                    value={{
                      status: blueprint.ai_status ?? null,
                      model: blueprint.ai_model ?? null,
                      run_id: blueprint.ai_run_id ?? null,
                      error: blueprint.ai_error ?? null,
                      raw_excerpt: blueprint.ai_raw_excerpt ?? null,
                    } as never}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: "enriched" | "repaired" | "fallback" | "scaffold_only" }) {
  const map = {
    enriched: { label: "AI enriched", cls: "border-emerald-600 text-emerald-700 bg-emerald-50" },
    repaired: { label: "AI repaired", cls: "border-sky-600 text-sky-700 bg-sky-50" },
    fallback: { label: "Fallback model", cls: "border-indigo-600 text-indigo-700 bg-indigo-50" },
    scaffold_only: { label: "Scaffold only", cls: "border-amber-600 text-amber-700 bg-amber-50" },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── Step 3: Cast ─────────────────────────────────────────────────────────

function StepCast({ draftId, countryCode, draft, onNext }: {
  draftId: string; countryCode: string; draft: DraftShape; onNext: () => void;
}) {
  const [personaCount, setPersonaCount] = useState(8);
  const [segmentCount, setSegmentCount] = useState(4);
  const [allowDR, setAllowDR] = useState(true);
  const cast = draft.cast_draft as {
    personas?: { name: string; archetype: string; summary: string; quote: string }[];
    segments?: { label: string; size_hint: string }[];
    instruments?: { kind: string; title: string }[];
    missing_evidence?: string[];
    deep_research?: { question: string; citations: string[] }[];
    evidence_summary?: { corpus: number; uploads: number; deep_research: number };
  } | null;

  const run = useMutation({
    mutationFn: () => draftCast({ data: { draftId, countryCode, personaCount, segmentCount, allowDeepResearch: allowDR } }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <h3 className="font-serif text-xl text-ink-950">Cast the study</h3>
        <p className="mt-1 text-sm text-ink-500">
          AI drafts personas, segments and instruments — corpus-first, with deep-web research for gaps.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Personas</span>
            <input type="number" min={4} max={16} value={personaCount}
              onChange={(e) => setPersonaCount(Math.min(16, Math.max(4, Number(e.target.value))))}
              className="mt-1 w-full border border-line-200 bg-paper-0 p-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Segments</span>
            <input type="number" min={2} max={6} value={segmentCount}
              onChange={(e) => setSegmentCount(Math.min(6, Math.max(2, Number(e.target.value))))}
              className="mt-1 w-full border border-line-200 bg-paper-0 p-1.5 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ink-700">
            <input type="checkbox" checked={allowDR} onChange={(e) => setAllowDR(e.target.checked)} />
            Allow open-web deep research for gaps
          </label>
          <button type="button" onClick={() => run.mutate()} disabled={run.isPending}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50">
            {run.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {run.isPending ? "Casting…" : cast ? "Recast" : "Cast"}
          </button>
          {run.isError && <p className="text-[11px] text-rose-600">{(run.error as Error).message}</p>}
          {run.isPending && (
            <p className="text-[11px] text-ink-500">
              Reading corpus · scanning uploads · probing gaps · calling deep research…
            </p>
          )}
        </div>
      </div>

      <div>
        {!cast ? (
          <div className="border border-dashed border-line-200 p-6 text-[12px] text-ink-500">
            The cast draft appears here — personas, segments, instruments, and an evidence ledger.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <SummaryCell label="Corpus refs" value={cast.evidence_summary?.corpus ?? 0} />
              <SummaryCell label="Uploads" value={cast.evidence_summary?.uploads ?? 0} />
              <SummaryCell label="Deep research" value={cast.evidence_summary?.deep_research ?? 0} />
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Personas · {cast.personas?.length ?? 0}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {(cast.personas ?? []).map((p, i) => (
                  <div key={i} className="border border-line-200 bg-paper-0 p-3">
                    <p className="font-serif text-sm text-ink-950">{p.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{p.archetype}</p>
                    <p className="mt-1 line-clamp-3 text-[12px] text-ink-700">{p.summary}</p>
                    {p.quote && <p className="mt-1 border-l-2 border-ink-500 pl-2 text-[11px] italic text-ink-700">“{p.quote}”</p>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Segments · {cast.segments?.length ?? 0}</p>
              <ul className="mt-2 space-y-1">
                {(cast.segments ?? []).map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between border border-line-200 bg-paper-50 px-2.5 py-1.5">
                    <span className="font-serif text-sm text-ink-950">{s.label}</span>
                    <span className="font-mono text-[10px] text-ink-500">{s.size_hint}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Instruments · {cast.instruments?.length ?? 0}</p>
              <ul className="mt-2 space-y-1">
                {(cast.instruments ?? []).map((ins, i) => (
                  <li key={i} className="flex items-baseline justify-between border border-line-200 px-2.5 py-1.5">
                    <span className="font-serif text-sm text-ink-950">{ins.title}</span>
                    <span className="font-mono text-[10px] text-ink-500">{ins.kind}</span>
                  </li>
                ))}
              </ul>
            </div>

            {cast.missing_evidence?.length ? (
              <details className="border border-line-200 p-3">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Evidence gaps probed · {cast.missing_evidence.length}
                </summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-ink-700">
                  {cast.missing_evidence.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </details>
            ) : null}

            <div>
              <button type="button" onClick={onNext}
                className="inline-flex items-center gap-1.5 border border-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0">
                Continue to preview <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line-200 bg-paper-50 p-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-xl text-ink-950 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────

function StepPreview({ draft, onNext, onBack }: { draft: DraftShape; onNext: () => void; onBack: () => void }) {
  const scope = draft.brief_scope as { title?: string; objectives?: string[] } | null;
  const cast = draft.cast_draft as {
    personas?: unknown[]; segments?: unknown[]; instruments?: unknown[];
    evidence_summary?: { corpus: number; uploads: number; deep_research: number };
  } | null;
  const blueprint = draft.outcome_blueprint as { deliverables?: { label: string }[] } | null;

  if (!cast) {
    return <div className="border border-dashed border-line-200 p-6 text-[12px] text-ink-500">Cast the study first.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Preview</p>
        <h3 className="mt-1 font-serif text-2xl text-ink-950">{scope?.title ?? draft.title}</h3>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <SummaryCell label="Personas" value={cast.personas?.length ?? 0} />
        <SummaryCell label="Segments" value={cast.segments?.length ?? 0} />
        <SummaryCell label="Instruments" value={cast.instruments?.length ?? 0} />
        <SummaryCell label="Evidence" value={(cast.evidence_summary?.corpus ?? 0) + (cast.evidence_summary?.uploads ?? 0) + (cast.evidence_summary?.deep_research ?? 0)} />
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Deliverables</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(blueprint?.deliverables ?? []).map((d, i) => (
            <li key={i} className="border border-ink-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-950">{d.label}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Objectives</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-ink-700">
          {(scope?.objectives ?? []).map((o, i) => <li key={i}>{o}</li>)}
        </ul>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onBack}
          className="border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950">
          Back
        </button>
        <button type="button" onClick={onNext}
          className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700">
          Approve & launch <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Launch ───────────────────────────────────────────────────────

function StepLaunch({ draftId, countryCode, onDone }: {
  draftId: string; countryCode: string; onDone: (studyId: string) => void;
}) {
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const commit = useMutation({
    mutationFn: () => commitStudy({ data: { draftId, countryCode, visibility } }),
    onSuccess: (res) => onDone(res.studyId),
  });

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <Rocket size={28} className="mx-auto text-ink-950" />
      <h3 className="font-serif text-xl text-ink-950">Launch the study</h3>
      <p className="text-sm text-ink-500">
        This commits the personas, segments, instruments, and evidence to your country workspace.
      </p>
      <div className="flex justify-center gap-3 text-[12px]">
        <label className="flex items-center gap-1"><input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /> Private</label>
        <label className="flex items-center gap-1"><input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Public</label>
      </div>
      <button type="button" onClick={() => commit.mutate()} disabled={commit.isPending}
        className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50">
        {commit.isPending ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
        {commit.isPending ? "Launching…" : "Launch study"}
      </button>
      {commit.isError && <p className="text-[11px] text-rose-600">{(commit.error as Error).message}</p>}
    </div>
  );
}
