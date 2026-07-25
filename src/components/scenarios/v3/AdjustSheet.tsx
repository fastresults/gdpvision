import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { runLocalEngine } from "@/lib/scenarios/local-engine";
import type { EngineRunResult } from "@/lib/scenarios.functions";

type LeverRow = {
  slug: string;
  sector_code: string;
  bounds: { min: number; max: number; default?: number };
  currentValue: number;
  impactPp: number;
};

export function AdjustSheet({
  open,
  onClose,
  engineInit,
  currentLevers,
  horizonYears,
  onPreview,
  onCommit,
  showAllHref,
}: {
  open: boolean;
  onClose: () => void;
  engineInit: EngineRunResult;
  currentLevers: Record<string, number>;
  horizonYears: number;
  onPreview: (levers: Record<string, number>, result: EngineRunResult) => void;
  onCommit: (levers: Record<string, number>) => Promise<void> | void;
  showAllHref: string;
}) {
  const topLevers: LeverRow[] = useMemo(() => {
    const attribution = new Map(
      engineInit.output.attribution.map((a) => [a.lever_slug, Math.abs(a.contribution_pp)]),
    );
    return engineInit.leverDefs
      .map((d) => ({
        slug: d.slug,
        sector_code: d.sector_code,
        bounds: d.bounds,
        currentValue: currentLevers[d.slug] ?? d.bounds.default ?? d.bounds.min,
        impactPp: attribution.get(d.slug) ?? 0,
      }))
      .sort((a, b) => b.impactPp - a.impactPp)
      .slice(0, 4);
  }, [engineInit, currentLevers]);

  const [draft, setDraft] = useState<Record<string, number>>(currentLevers);
  const [committing, setCommitting] = useState(false);

  function handleChange(slug: string, value: number) {
    const next = { ...draft, [slug]: value };
    setDraft(next);
    const result = runLocalEngine(engineInit, next, horizonYears);
    onPreview(next, result);
  }

  async function commit() {
    setCommitting(true);
    try {
      await onCommit(draft);
    } finally {
      setCommitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-paper-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line-200 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              Adjust
            </p>
            <h3 className="mt-1 font-serif text-lg text-ink-950">Biggest movers</h3>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !p-2">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {topLevers.length === 0 && (
            <p className="text-sm text-ink-500">No levers are moving this scenario yet.</p>
          )}
          {topLevers.map((l) => (
            <LeverSlider
              key={l.slug}
              lever={l}
              value={draft[l.slug] ?? l.currentValue}
              onChange={(v) => handleChange(l.slug, v)}
            />
          ))}

          <a href={showAllHref} className="btn-ghost inline-flex text-[11px]">
            Show all levers →
          </a>
        </div>

        <footer className="border-t border-line-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={committing}
              className="btn-primary disabled:opacity-40"
            >
              {committing ? "Saving…" : "Save as new version"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function LeverSlider({
  lever,
  value,
  onChange,
}: {
  lever: LeverRow;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = Math.max(0.01, (lever.bounds.max - lever.bounds.min) / 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-ink-950">{humanize(lever.slug)}</label>
        <span className="font-mono text-xs text-ink-700 tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-500">
        {lever.sector_code} · biggest mover {lever.impactPp.toFixed(2)}pp
      </p>
      <input
        type="range"
        min={lever.bounds.min}
        max={lever.bounds.max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1 w-full cursor-pointer appearance-none bg-line-200 accent-ink-950"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-500 tabular-nums">
        <span>{lever.bounds.min.toFixed(2)}</span>
        <span>default {(lever.bounds.default ?? lever.bounds.min).toFixed(2)}</span>
        <span>{lever.bounds.max.toFixed(2)}</span>
      </div>
    </div>
  );
}

function humanize(slug: string): string {
  return slug
    .replace(/[_\-.]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bCbi\b/g, "CBI")
    .replace(/\bGdp\b/g, "GDP");
}
