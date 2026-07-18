import { useMemo } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Pin, Save, Sparkles, X } from "lucide-react";
import type { EngineRunResult } from "@/lib/scenarios.functions";
import { PLAYBOOKS, type Playbook } from "@/lib/scenarios/playbooks";
import { StepProgress, type Step } from "./StepProgress";
import { PlaybookCard } from "./PlaybookCard";
import { AiPlaySuggestions } from "./AiPlaySuggestions";
import { LeverRow } from "./LeverRow";
import { CoachTip } from "./CoachTip";

const STEPS: Step[] = [
  { id: 1, label: "Frame the question", hint: "Name the decision you're rehearsing." },
  { id: 2, label: "Pick a starting play", hint: "Choose a preset thesis to seed levers." },
  { id: 3, label: "Tune the levers", hint: "Drag and watch the fan bend." },
  { id: 4, label: "Read & save", hint: "Confirm the story, save or pin." },
];

export interface Ministry {
  slug: string;
  name: string;
}

export function GuidedRail({
  step,
  furthest,
  onStep,
  countryCode,
  // Step 1
  title,
  onTitle,
  ministries,
  ministrySlug,
  onMinistry,
  horizonYears,
  onHorizon,
  // Step 2
  init,
  activePlaybookIds,
  onTogglePlaybook,
  onClearPlaybooks,
  aiPlays,
  onRegisterAiPlay,
  // Step 3
  levers,
  locks,
  onLever,
  onToggleLock,
  onResetLever,
  onResetAll,
  showAllLevers,
  onToggleShowAll,
  current,
  // Step 4
  assumptionsNote,
  onAssumptions,
  onSave,
  onSavePin,
  savePending,
  saveError,
}: {
  step: number;
  furthest: number;
  onStep: (n: number) => void;
  countryCode: string;
  title: string;
  onTitle: (v: string) => void;
  ministries: Ministry[];
  ministrySlug: string;
  onMinistry: (v: string) => void;
  horizonYears: number;
  onHorizon: (v: number) => void;
  init: EngineRunResult;
  activePlaybookIds: Set<string>;
  onTogglePlaybook: (p: Playbook) => void;
  onClearPlaybooks: () => void;
  aiPlays: Playbook[];
  onRegisterAiPlay: (p: Playbook) => void;
  levers: Record<string, number>;
  locks: Record<string, boolean>;
  onLever: (slug: string, value: number) => void;
  onToggleLock: (slug: string) => void;
  onResetLever: (slug: string) => void;
  onResetAll: () => void;
  showAllLevers: boolean;
  onToggleShowAll: () => void;
  current: EngineRunResult;
  assumptionsNote: string;
  onAssumptions: (v: string) => void;
  onSave: () => void;
  onSavePin: () => void;
  savePending: boolean;
  saveError: string | null;
}) {
  const activePlaybooks = useMemo<Playbook[]>(() => {
    const byId = new Map<string, Playbook>();
    for (const p of PLAYBOOKS) byId.set(p.id, p);
    for (const p of aiPlays) byId.set(p.id, p);
    return Array.from(activePlaybookIds)
      .map((id) => byId.get(id))
      .filter((p): p is Playbook => !!p);
  }, [activePlaybookIds, aiPlays]);

  const canAdvance = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return activePlaybookIds.size > 0;
    return true;
  }, [step, title, activePlaybookIds]);

  const attributionMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of current.output.attribution) m[a.lever_slug] = a.contribution_pp;
    return m;
  }, [current.output.attribution]);

  // Levers touched by the current playbook (or all if user opts in)
  const focusedSlugs = useMemo(() => {
    if (showAllLevers) return new Set(init.leverDefs.map((d) => d.slug));
    const s = new Set<string>();
    for (const d of init.leverDefs) {
      const dflt = d.bounds.default ?? d.bounds.min;
      if (Math.abs((levers[d.slug] ?? dflt) - dflt) > 0.001) s.add(d.slug);
    }
    // Top-6 by |attribution| among defs
    const ranked = [...init.leverDefs]
      .map((d) => ({ slug: d.slug, w: Math.abs(attributionMap[d.slug] ?? 0) }))
      .sort((a, b) => b.w - a.w);
    for (const r of ranked) {
      if (s.size >= 6) break;
      s.add(r.slug);
    }
    return s;
  }, [showAllLevers, init.leverDefs, attributionMap, levers]);

  const topAttribution = useMemo(
    () =>
      [...current.output.attribution]
        .sort((a, b) => Math.abs(b.contribution_pp) - Math.abs(a.contribution_pp))
        .slice(0, 3),
    [current.output.attribution],
  );

  const ministryName =
    ministries.find((m) => m.slug === ministrySlug)?.name ?? "Cross-portfolio";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line-200 px-5 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Guided rehearsal
        </p>
        <h2 className="mt-1 font-serif text-lg text-ink-950">
          Four moves to a Cabinet-ready scenario
        </h2>
      </div>

      <div className="border-b border-line-200 px-3 py-3">
        <StepProgress steps={STEPS} current={step} furthest={furthest} onJump={onStep} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                What decision are you rehearsing?
              </p>
              <input
                autoFocus
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="e.g. Wind CBI down over 3 years"
                className="mt-2 w-full border-b border-line-200 bg-transparent py-1.5 font-serif text-lg outline-none placeholder:text-ink-500/50 focus:border-ink-950"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                Give this a specific, headline-style name — the way you'd brief a Prime Minister.
              </p>
            </div>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Portfolio scope
              </span>
              <select
                value={ministrySlug}
                onChange={(e) => onMinistry(e.target.value)}
                className="mt-2 w-full truncate border border-line-200 bg-paper-0 px-2 py-1.5 text-sm focus:border-ink-950 focus:outline-none"
                title={ministryName}
              >
                <option value="">Cross-portfolio</option>
                {ministries.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Horizon
              </span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={horizonYears}
                  onChange={(e) => onHorizon(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-10 text-right font-mono text-sm tabular-nums">
                  {horizonYears}y
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                How far out should the engine project? The canvas on the right shows the current
                do-nothing baseline over this window.
              </p>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Pick a starting play
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-700">
                Each play is a plausible policy stance. It seeds the levers so you can start from
                intent, not a blank slate. You'll tune the specifics next.
              </p>
            </div>
            <PlaybookCard
              defs={init.leverDefs}
              activeId={activePlaybook}
              onPick={onPickPlaybook}
            />
            <p className="text-[11px] leading-relaxed text-ink-500">
              Not seeing the right posture? Pick <em>Baseline hold</em> and adjust levers by hand
              in the next step.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Tune the levers
                <CoachTip id="tune-intro" title="Cause & effect">
                  Drag any lever. The fan chart on the right redraws — the dashed line shows where
                  you were <em>before</em> the drag, so the effect is immediate and visible.
                </CoachTip>
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-700">
                Only the levers that matter most for the current path are shown. Each row spells
                out the effect on Year 1 GDP.
              </p>
            </div>

            <div className="divide-y divide-line-200 border-y border-line-200">
              {init.leverDefs
                .filter((d) => focusedSlugs.has(d.slug))
                .map((def) => {
                  const value = levers[def.slug] ?? def.bounds.default ?? def.bounds.min;
                  return (
                    <LeverRow
                      key={def.slug}
                      def={def}
                      value={value}
                      locked={!!locks[def.slug]}
                      attribution={current.output.attribution.find(
                        (a) => a.lever_slug === def.slug,
                      )}
                      onChange={(v) => onLever(def.slug, v)}
                      onToggleLock={() => onToggleLock(def.slug)}
                      onReset={() => onResetLever(def.slug)}
                    />
                  );
                })}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onToggleShowAll}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950"
              >
                <ChevronDown
                  size={12}
                  className={"transition " + (showAllLevers ? "rotate-180" : "")}
                />
                {showAllLevers
                  ? "Show focused levers only"
                  : `Show all ${init.leverDefs.length} levers`}
              </button>
              <button
                type="button"
                onClick={onResetAll}
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950"
              >
                Reset all
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Read the scenario
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-700">
                A one-page brief for the Cabinet table.
              </p>
            </div>

            <dl className="space-y-2 border-y border-line-200 py-3 text-[12px]">
              <Row label="Question">{title || "(untitled)"}</Row>
              <Row label="Scope">{ministryName}</Row>
              <Row label="Horizon">{horizonYears} years</Row>
              <Row label="Starting play">
                {activePlaybook ?? "—"}
              </Row>
            </dl>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Top 3 movers · Y1 GDP contribution
              </p>
              <ul className="mt-2 space-y-1.5 text-[12px]">
                {topAttribution.length === 0 && (
                  <li className="text-ink-500">Levers at default — no attribution.</li>
                )}
                {topAttribution.map((a) => (
                  <li key={a.lever_slug} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-ink-950">{a.lever_slug}</span>
                    <span
                      className="shrink-0 font-mono text-[11px] tabular-nums"
                      style={{
                        color:
                          a.contribution_pp > 0
                            ? "var(--sector-06)"
                            : a.contribution_pp < 0
                              ? "var(--sector-04)"
                              : "var(--ink-500)",
                      }}
                    >
                      {a.contribution_pp > 0 ? "+" : ""}
                      {a.contribution_pp.toFixed(2)} pp
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                Assumptions & so-what
              </span>
              <textarea
                value={assumptionsNote}
                onChange={(e) => onAssumptions(e.target.value)}
                placeholder="What must be true for this to hold? What's the ask of Cabinet?"
                rows={4}
                className="mt-2 w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-xs leading-relaxed focus:border-ink-950 focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={savePending}
                className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-50"
              >
                <Save size={12} /> Save draft
              </button>
              <button
                type="button"
                onClick={onSavePin}
                disabled={savePending}
                className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
              >
                <Pin size={12} /> {savePending ? "Saving…" : "Save & pin"}
              </button>
            </div>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line-200 px-5 py-3">
        <button
          type="button"
          onClick={() => onStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950 disabled:opacity-30"
        >
          <ArrowLeft size={12} /> Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => onStep(step + 1)}
            disabled={!canAdvance}
            className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700 disabled:opacity-30"
          >
            Next <ArrowRight size={12} />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            <Sparkles size={11} /> ready to save
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink-950">{children}</dd>
    </div>
  );
}
