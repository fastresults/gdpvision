import { ChevronDown } from "lucide-react";

import { PrettyJson } from "@/components/data/PrettyJson";

/**
 * The whole arithmetic, in the open. Nothing in the verdict is unexplained.
 * Controlled, so a rationale modal can hand the reader straight to the record.
 */
export function ArithmeticDrawer({
  trace,
  open,
  onOpenChange,
}: {
  trace: Record<string, unknown>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <div className="border border-line-200 bg-paper-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="btn-ghost flex w-full items-center justify-between px-5 py-4 text-left font-mono text-[11px] uppercase tracking-[0.18em]"
      >
        <span>{open ? "Close the arithmetic" : "Open the arithmetic"}</span>
        <ChevronDown
          className={open ? "h-4 w-4 rotate-180 transition-transform" : "h-4 w-4 transition-transform"}
        />
      </button>

      {open ? (
        <div className="border-t border-line-200 px-5 py-5">
          <p className="mb-5 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
            Every figure in the verdict derives from the values below. Nothing is inferred, sampled
            or randomised — the same inputs will always produce the same result.
          </p>
          <PrettyJson value={trace as never} showRaw={false} />
        </div>
      ) : null}
    </div>
  );
}
