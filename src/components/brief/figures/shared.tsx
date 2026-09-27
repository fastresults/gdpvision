// Shared frame for the Decision Brief's four figures. Colour comes from the
// country's flag (via egov/brand.ts): the accent marks the country, the first
// structural border marks the comparison. Type stays in the house ink; colour
// never carries text and never fills behind it.

import type { ReactNode } from "react";

import { buildBrandTokens, contrastRatio } from "@/lib/egov/brand";

export interface BriefPalette {
  /** The flag's own accent, for the printed band only (may be pale). */
  band: string;
  /** Marks for the country itself. */
  accent: string;
  /** Marks for the comparison (region, conservative, cost). */
  compare: string;
  /** Neutral rules and axes. */
  rule: string;
  ink: string;
  muted: string;
}

export function briefPalette(code: string): BriefPalette {
  const t = buildBrandTokens(code);
  // Marks must hold 3:1 against the paper (WCAG 1.4.11). A pale flag accent
  // (gold, yellow) keeps the printed band; data marks take the next colours.
  const marks = [t.accent, ...t.borders, t.ink].filter(
    (hex, i, all) => all.indexOf(hex) === i && contrastRatio(hex, "#FFFFFF") >= 3,
  );
  return {
    band: t.accent,
    accent: marks[0] ?? "#141414",
    compare: marks[1] ?? "#6B6B6B",
    rule: "#D9D6CF",
    ink: "#141414",
    muted: "#6B6B6B",
  };
}

export const MONO = "var(--font-mono, ui-monospace, monospace)";
export const SERIF = "var(--font-serif, Georgia, serif)";

export function Figure({
  n,
  title,
  caption,
  legend,
  children,
}: {
  n: number;
  title: string;
  caption: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="break-inside-avoid border-t border-line-200 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Figure {n}
        </div>
        {legend ? <div className="flex flex-wrap gap-x-4 gap-y-1">{legend}</div> : null}
      </div>
      <h3 className="mt-2 font-serif text-[19px] leading-snug text-ink-950">{title}</h3>
      <div className="mt-4">{children}</div>
      <figcaption className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-ink-500">
        {caption}
      </figcaption>
    </figure>
  );
}

export function Key({
  colour,
  label,
  dashed,
}: {
  colour: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
      <svg width="18" height="6" aria-hidden>
        <line
          x1="0"
          y1="3"
          x2="18"
          y2="3"
          stroke={colour}
          strokeWidth="3"
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

export const pct = (v: number, d = 2) => `${v.toFixed(d)}%`;
