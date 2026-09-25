// Small, shared pieces for the investment pages, in the GDPVision house style:
// status as coloured text with a dot or a left rule, never a filled pill.

import type { ReactNode } from "react";

import { APPROVAL_LABEL } from "@/lib/investments/readiness";
import { cn } from "@/lib/utils";

export function formatUsd(
  n: number | string | null | undefined,
  opts: { empty?: string } = {},
): string {
  const v = Number(n);
  if (n == null || n === "" || !Number.isFinite(v)) return opts.empty ?? "—";
  if (Math.abs(v) >= 1e9) return `US$${(v / 1e9).toFixed(2)} bn`;
  if (Math.abs(v) >= 1e6) return `US$${(v / 1e6).toFixed(1)} m`;
  if (Math.abs(v) >= 1e3) return `US$${(v / 1e3).toFixed(0)} k`;
  return `US$${Math.round(v).toLocaleString("en-US")}`;
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export const APPROVAL_TONE: Record<string, string> = {
  draft: "text-ink-500",
  submitted: "text-signal-caution",
  approved: "text-signal-positive",
  returned: "text-signal-negative",
  withdrawn: "text-ink-400",
};

const DOT_TONE: Record<string, string> = {
  draft: "bg-ink-300",
  submitted: "bg-signal-caution",
  approved: "bg-signal-positive",
  returned: "bg-signal-negative",
  withdrawn: "bg-ink-300",
};

export function Dot({
  tone,
  className,
}: {
  tone: "positive" | "negative" | "caution" | "muted" | "gold";
  className?: string;
}) {
  const bg = {
    positive: "bg-signal-positive",
    negative: "bg-signal-negative",
    caution: "bg-signal-caution",
    muted: "bg-ink-300",
    gold: "bg-gold-500",
  }[tone];
  return (
    <span
      aria-hidden
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", bg, className)}
    />
  );
}

export function ApprovalMark({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        APPROVAL_TONE[status] ?? "text-ink-500",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("inline-block h-1.5 w-1.5 rounded-full", DOT_TONE[status] ?? "bg-ink-300")}
      />
      {APPROVAL_LABEL[status] ?? status}
    </span>
  );
}

/** "7/10" with a thin rule underneath. */
export function ReadinessRule({
  score,
  total = 10,
  className,
}: {
  score: number;
  total?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / total) * 100));
  const tone = score >= total ? "bg-signal-positive" : "bg-gold-500";
  return (
    <span className={cn("inline-flex min-w-[3.5rem] flex-col gap-1", className)}>
      <span className="text-xs tabular-nums text-ink-950">
        {score}/{total}
      </span>
      <span className="block h-px w-full bg-line-200">
        <span className={cn("block h-px", tone)} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

export function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500", className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  id,
}: {
  children: ReactNode;
  hint?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="mb-3 scroll-mt-24 border-b border-line-200 pb-2">
      <h3 className="font-display text-lg text-ink-950">{children}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** A bordered note with a coloured left rule — for warnings and returned notes. */
export function Note({
  tone = "muted",
  title,
  children,
  className,
}: {
  tone?: "positive" | "negative" | "caution" | "muted";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const border = {
    positive: "border-l-signal-positive",
    negative: "border-l-signal-negative",
    caution: "border-l-signal-caution",
    muted: "border-l-line-200",
  }[tone];
  const titleTone = {
    positive: "text-signal-positive",
    negative: "text-signal-negative",
    caution: "text-signal-caution",
    muted: "text-ink-700",
  }[tone];
  return (
    <div
      className={cn(
        "border border-line-200 border-l-2 bg-paper-0 px-3 py-2 text-sm text-ink-800",
        border,
        className,
      )}
    >
      {title && <div className={cn("mb-0.5 text-xs font-medium", titleTone)}>{title}</div>}
      {children}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-signal-negative">
      {children}
    </p>
  );
}

export const inputCls =
  "w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none disabled:bg-paper-50 disabled:text-ink-500";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-xs text-ink-700", className)}>
      <span className="mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

/** Tab strip styling: underline on the active tab, no filled background. */
export const tabListCls =
  "h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-line-200 bg-transparent p-0";
export const tabTriggerCls =
  "-mb-px rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-ink-500 data-[state=active]:border-gold-500 data-[state=active]:bg-transparent data-[state=active]:text-ink-950 data-[state=active]:shadow-none";

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? "Something went wrong.");
}
