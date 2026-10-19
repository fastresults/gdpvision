// Small presentational pieces shared by the Caribbean Indices back office tabs.
// Hierarchy comes from type, rules and borders — no solid fills behind text.

import type { ReactNode } from "react";

export const INDEX_CODES = ["CGX", "CHX", "CGV", "CCX"] as const;
export type IndexCode = (typeof INDEX_CODES)[number];

export const fieldCls = "w-full border border-line-200 bg-paper-0 px-2 py-1 text-sm";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{children}</p>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-serif text-2xl tabular-nums text-ink-950">{value}</dd>
      {sub && <dd className="text-xs text-ink-500">{sub}</dd>}
    </div>
  );
}

const TONE: Record<string, string> = {
  good: "border-emerald-700/40 text-emerald-800",
  warn: "border-amber-700/40 text-amber-800",
  bad: "border-red-700/40 text-red-700",
  quiet: "border-line-200 text-ink-500",
};

/** Outlined status word. Meaning is always in the word, never colour alone. */
export function Tag({
  tone = "quiet",
  children,
}: {
  tone?: keyof typeof TONE;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function runStatusTone(s: string): keyof typeof TONE {
  return s === "complete" ? "good" : s === "failed" ? "bad" : "warn";
}

export function releaseTone(s: string): keyof typeof TONE {
  return s === "published" ? "good" : s === "withdrawn" ? "bad" : "warn";
}

export function sextantTone(b: string | null | undefined): keyof typeof TONE {
  return b === "clear"
    ? "good"
    : b === "fair"
      ? "quiet"
      : b === "hazy"
        ? "warn"
        : b === "obscured"
          ? "bad"
          : "quiet";
}

export function fmt(n: number | null | undefined, dp = 1): string {
  return n == null || Number.isNaN(n) ? "—" : n.toFixed(dp);
}

export function signed(n: number | null | undefined, dp = 1): string {
  if (n == null) return "—";
  const v = n.toFixed(dp);
  return n > 0 ? `+${v}` : v;
}

export function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-line-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-ink-950">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-500">{children}</p>;
}

/**
 * Tab / filter toggle. The active one gets an ink outline and underline, never a solid
 * fill behind its text; solid `btn-primary` stays for real primary actions.
 */
export function toggleCls(active: boolean): string {
  return active
    ? "btn-secondary !border-ink-950 text-ink-950 shadow-[inset_0_-2px_0_var(--ink-950)]"
    : "btn-secondary text-ink-500";
}
