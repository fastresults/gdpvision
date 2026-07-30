import { useState } from "react";

import { PrettyJson } from "@/components/data/PrettyJson";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Rationale } from "@/lib/explain/registry";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * The full derivation of a single figure or assumption: what it is, how it is
 * derived, the arithmetic with the reader's own numbers, the basis, and the
 * caveat. Pure client-side — opening it never costs a request.
 */
export function RationaleModal({
  rationale,
  ctx,
  open,
  onOpenChange,
  onTrace,
  traceLabel = "See the full arithmetic",
}: {
  rationale: Rationale<never>;
  ctx: unknown;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTrace?: () => void;
  traceLabel?: string;
}) {
  const [showRaw, setShowRaw] = useState(false);

  let lines: Array<{ label: string; value: string; note?: string }> = [];
  let deriveError: string | null = null;
  try {
    lines = rationale.derive ? rationale.derive(ctx as never) : [];
  } catch {
    deriveError = "This derivation could not be shown for the current configuration.";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-24px)] max-w-2xl gap-0 overflow-y-auto rounded-none border-line-200 bg-paper-0 p-0 sm:rounded-none">
        <DialogHeader className="space-y-0 border-b border-line-200 px-5 py-5 text-left sm:px-7">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            How this is derived
          </div>
          <DialogTitle className="mt-3 font-serif text-[24px] font-normal leading-tight tracking-tight text-ink-950 md:text-[28px]">
            {rationale.title}
          </DialogTitle>
          <DialogDescription className="mt-3 text-[15px] leading-relaxed text-ink-700">
            {rationale.short}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 px-5 py-7 sm:px-7">
          {rationale.formula ? (
            <Block label="How it is derived">
              <p className="border-l-2 border-ink-950 pl-4 font-mono text-[12.5px] leading-relaxed text-ink-950">
                {rationale.formula}
              </p>
            </Block>
          ) : null}

          {deriveError ? (
            <p className="text-[14px] leading-relaxed text-ink-500">{deriveError}</p>
          ) : lines.length > 0 ? (
            <Block label="With your numbers">
              <dl className="divide-y divide-line-100 border-y border-line-100">
                {lines.map((l, i) => (
                  <div
                    key={`${l.label}-${i}`}
                    className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6"
                  >
                    <dt className="text-[14px] leading-snug text-ink-700">
                      {l.label}
                      {l.note ? (
                        <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-500">
                          {l.note}
                        </span>
                      ) : null}
                    </dt>
                    <dd className="font-mono text-[13px] tabular-nums text-ink-950 sm:text-right">
                      {l.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Block>
          ) : null}

          {rationale.basis ? (
            <Block label="Why we believe it">
              <p className="text-[14.5px] leading-relaxed text-ink-700">{rationale.basis}</p>
            </Block>
          ) : null}

          {rationale.caveat ? (
            <Block label="What would change it">
              <p className="text-[14.5px] leading-relaxed text-ink-700">{rationale.caveat}</p>
            </Block>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-line-200 pt-6">
            {onTrace ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onTrace();
                }}
                className="btn-secondary px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]"
              >
                {traceLabel} →
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              aria-expanded={showRaw}
              className="btn-ghost px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]"
            >
              {showRaw ? "Hide the record" : "Show the record"}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              {rationale.key}
            </span>
          </div>

          {showRaw ? (
            <PrettyJson
              value={
                {
                  key: rationale.key,
                  formula: rationale.formula ?? null,
                  basis: rationale.basis ?? null,
                  caveat: rationale.caveat ?? null,
                  derivation: lines,
                } as never
              }
              showRaw={false}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
