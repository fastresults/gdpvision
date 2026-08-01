// Chamber 07 · The action head.
//
// Every wizard screen answers three questions in the same place, in the same
// words: where am I (state), what do I do here (one instruction), and is there
// one thing to press (at most one in-screen action). The button that LEAVES the
// screen always lives in the footer — never here.

import { Check, CircleDashed, Loader2, CircleDot } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ScreenActionSpec {
  /** The single imperative sentence for this screen. */
  instruction: string;
  /** The specific thing still missing, when the screen is not done. */
  outstanding?: string | null;
  /** The quiet confirmation once the screen is done — e.g. "Panel formed · 12 members". */
  doneNote?: string | null;
  /** At most one in-screen action. Omit when the screen has nothing to press. */
  action?: {
    label: string;
    onClick: () => void;
    pending?: boolean;
    disabled?: boolean;
    icon?: ReactNode;
    /** One line under the button describing what pressing it does. */
    note?: string;
  } | null;
  /** A short error to surface beside the action. */
  error?: string | null;
}

export function ScreenAction({ spec, done }: { spec: ScreenActionSpec; done: boolean }) {
  const state = done ? "Done" : spec.action?.pending ? "Working" : "To do";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 border p-3",
        done ? "border-emerald-500/40 bg-emerald-500/5" : "border-ink-950 bg-paper-50",
      )}
    >
      <span className="mt-0.5 shrink-0">
        {done ? (
          <Check size={14} className="text-emerald-600" strokeWidth={3} />
        ) : spec.action?.pending ? (
          <Loader2 size={14} className="animate-spin text-ink-600" />
        ) : (
          <CircleDashed size={14} className="text-ink-500" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          On this screen · {state}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-950">{spec.instruction}</p>

        {done && spec.doneNote ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700">
            {spec.doneNote}
          </p>
        ) : null}

        {!done && spec.outstanding ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-600">
            <CircleDot size={11} className="shrink-0 text-ink-500" />
            Outstanding · {spec.outstanding}
          </p>
        ) : null}

        {spec.error ? <p className="mt-1 text-[12px] text-rose-600">{spec.error}</p> : null}
      </div>

      {spec.action?.note ? (
        <p className="w-full border-t border-line-200 pt-2 text-[11px] leading-tight text-ink-500">
          What happens next · {spec.action.note}
        </p>
      ) : null}
    </div>
  );
}
