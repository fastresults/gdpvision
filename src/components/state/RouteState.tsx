// Shared state primitives for authenticated routes (PRD Wave G1).
// Provides consistent empty / loading / error / stale visuals across the app.

import { type ReactNode } from "react";

interface BaseProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function RouteEmpty({ title, description, action }: BaseProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-xl flex-col items-center border border-dashed border-line-200 p-14 text-center"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Empty</p>
      <h2 className="mt-4 font-serif text-2xl text-ink-950">{title}</h2>
      {description && <p className="mt-3 text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function RouteLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center gap-3 py-16 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-500" aria-hidden="true" />
      {label}
    </div>
  );
}

export function RouteError({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-xl border border-red-200 bg-red-50 p-8 text-red-950"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-red-700">Error</p>
      <h2 className="mt-3 font-serif text-2xl">{title}</h2>
      {description && <p className="mt-2 text-sm">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 font-mono text-[10px] uppercase tracking-widest text-red-800 underline underline-offset-4 hover:text-red-950"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function RouteStale({ asOf, note }: { asOf: string | Date; note?: string }) {
  const stamp = typeof asOf === "string" ? asOf : asOf.toISOString();
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-baseline gap-3 border border-amber-200 bg-amber-50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800"
    >
      <span>Stale</span>
      <time dateTime={stamp}>{new Date(stamp).toLocaleString()}</time>
      {note && <span className="normal-case tracking-normal">· {note}</span>}
    </div>
  );
}
