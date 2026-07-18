// Step-4 inline sliders for the top movers. Lets a PM micro-tune the
// assumption right from the read-out page and watch the fan bend without
// jumping back to Step 3.

import type { EngineInput } from "@/lib/engine/v1_macro";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

function titleize(slug: string) {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SensitivityMini({
  slugs,
  defs,
  levers,
  attribution,
  onLever,
}: {
  slugs: string[];
  defs: EngineInput["leverDefs"];
  levers: Record<string, number>;
  attribution: Array<{ lever_slug: string; contribution_pp: number }>;
  onLever: (slug: string, v: number) => void;
}) {
  const defBySlug = new Map(defs.map((d) => [d.slug, d]));
  const contribBySlug = new Map(attribution.map((a) => [a.lever_slug, a.contribution_pp]));

  if (slugs.length === 0) {
    return (
      <p className="text-[11px] text-ink-500">
        Levers are at default — no movers to fine-tune. Drag any lever in Step 3 first.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {slugs.map((slug) => {
        const def = defBySlug.get(slug);
        if (!def) return null;
        const dflt = def.bounds.default ?? def.bounds.min;
        const val = levers[slug] ?? dflt;
        const contrib = contribBySlug.get(slug) ?? 0;
        const sector = CANONICAL_SECTORS.find((c) => c.slug === def.sector_code);
        return (
          <li key={slug} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-ink-950">{titleize(def.slug)}</span>
              <span
                className="shrink-0 font-mono text-[11px] tabular-nums"
                style={{
                  color:
                    contrib > 0
                      ? "var(--sector-06)"
                      : contrib < 0
                        ? "var(--sector-04)"
                        : "var(--ink-500)",
                }}
              >
                {contrib > 0 ? "+" : ""}
                {contrib.toFixed(2)} pp
              </span>
            </div>
            <input
              type="range"
              min={def.bounds.min}
              max={def.bounds.max}
              step={0.5}
              value={val}
              onChange={(e) => onLever(slug, Number(e.target.value))}
              className="w-full"
              aria-label={`Micro-tune ${def.slug}`}
              style={{ accentColor: `var(${sector?.cssVar ?? "--ink-950"})` }}
            />
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
              <span className="tabular-nums">{def.bounds.min}</span>
              <span className="tabular-nums">value {val.toFixed(1)} · default {dflt.toFixed(1)}</span>
              <span className="tabular-nums">{def.bounds.max}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
