// Chamber 07 · Field desk · one beat of a procedure.
//
// A wave is a procedure, not a panel of options. Each beat states its number,
// what it is for, and whether it is behind you, live, or still locked — and
// only the live beat carries an emphasised control.

import { Check, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Hint } from "./Hint";
import { cn } from "@/lib/utils";

export type StepState = "done" | "live" | "locked";

export function StepLadder({ children }: { children: ReactNode }) {
  return <ol className="divide-y divide-line-100 border border-line-200 bg-paper-0">{children}</ol>;
}

export function StepRow({
  index,
  title,
  instruction,
  state,
  hint,
  unlocks,
  summary,
  children,
}: {
  index: number;
  title: string;
  /** One sentence telling the operator what to do here. */
  instruction: string;
  state: StepState;
  hint?: { what: string; then?: string };
  /** Shown when locked: the condition that opens this beat. */
  unlocks?: string;
  /** Shown when done, in place of the body: the settled fact. */
  summary?: ReactNode;
  children?: ReactNode;
}) {
  const live = state === "live";
  const done = state === "done";

  return (
    <li
      aria-current={live ? "step" : undefined}
      aria-disabled={state === "locked" || undefined}
      className={cn(
        "p-4 transition-colors",
        live && "bg-paper-50",
        state === "locked" && "opacity-55",
      )}
    >
      <div className="flex gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[11px] tabular-nums",
            done
              ? "border-ink-950 bg-ink-950 text-paper-0"
              : live
                ? "border-ink-950 bg-paper-0 text-ink-950"
                : "border-line-200 bg-paper-0 text-ink-400",
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h4
              className={cn(
                "text-[14px] leading-snug",
                live ? "font-medium text-ink-950" : "text-ink-800",
              )}
            >
              {title}
            </h4>
            {hint ? <Hint what={hint.what} {...(hint.then ? { then: hint.then } : {})} /> : null}
            {state === "locked" ? (
              <Lock aria-hidden className="h-3 w-3 shrink-0 text-ink-400" />
            ) : null}
          </div>

          {done && summary ? (
            <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{summary}</p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{instruction}</p>
          )}

          {state === "locked" && unlocks ? (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
              Unlocks when · {unlocks}
            </p>
          ) : null}

          {state !== "locked" && !done ? (
            children ? (
              <div className="mt-3">{children}</div>
            ) : null
          ) : null}
          {done && children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </li>
  );
}
