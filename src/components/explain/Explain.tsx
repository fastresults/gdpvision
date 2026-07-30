import { useEffect, useState } from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { getRationale } from "@/lib/explain/registry";
import { cn } from "@/lib/utils";

import { useExplainContext } from "./ExplainProvider";
import { RationaleModal } from "./RationaleModal";

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const apply = () => setCoarse(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return coarse;
}

/**
 * The single interrogation affordance. Wrap any figure, label or model-authored
 * line whose derivation a reader may reasonably question.
 *
 *   <Explain id="calc.uplift">US$41.2 m</Explain>
 *
 * Desktop: hover or focus shows the one-line rationale; click opens the full
 * derivation. Touch: tap opens the derivation directly. Print: the affordance
 * disappears and the content renders as plain text.
 */
export function Explain({
  id,
  children,
  ctx: ctxOverride,
  className,
  mark = true,
  underline = true,
  label,
}: {
  /** Registry key, e.g. "calc.uplift". */
  id: string;
  children: React.ReactNode;
  /** Overrides the provider context for this one trigger. */
  ctx?: unknown;
  className?: string;
  /** Show the small superscript mark. */
  mark?: boolean;
  /** Show the dotted underline. */
  underline?: boolean;
  /** Accessible name suffix, defaults to the rationale title. */
  label?: string;
}) {
  const rationale = getRationale(id);
  const { ctx, onTrace, traceLabel } = useExplainContext();
  const [open, setOpen] = useState(false);
  const coarse = useCoarsePointer();

  // An unregistered key must never break the page — render the content plainly.
  if (!rationale) return <>{children}</>;

  const activeCtx = ctxOverride !== undefined ? ctxOverride : ctx;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={`${label ?? rationale.title} — how this is derived`}
      className={cn(
        "group inline cursor-help text-left align-baseline print:cursor-auto",
        underline &&
          "decoration-line-200 decoration-dotted underline-offset-[5px] hover:decoration-ink-700 focus-visible:decoration-ink-950 [text-decoration-line:underline] print:no-underline",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-950 focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
      {mark ? (
        <span
          aria-hidden
          className="ml-[3px] align-super font-mono text-[0.62em] leading-none text-ink-500 transition-colors group-hover:text-ink-950 print:hidden"
        >
          ⓘ
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      {coarse ? (
        trigger
      ) : (
        <HoverCard openDelay={150} closeDelay={80}>
          <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="z-50 max-h-[min(18rem,var(--radix-hover-card-content-available-height))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-none border-line-200 bg-paper-0 p-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)] print:hidden"
          >
            <div className="break-words font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-500">
              {rationale.title}
            </div>
            <p className="mt-2 break-words text-[13px] leading-relaxed text-ink-700">{rationale.short}</p>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-950">
              See the full derivation →
            </div>
          </HoverCardContent>
        </HoverCard>
      )}

      {open ? (
        <RationaleModal
          rationale={rationale}
          ctx={activeCtx}
          open={open}
          onOpenChange={setOpen}
          onTrace={onTrace}
          traceLabel={traceLabel}
        />
      ) : null}
    </>
  );
}
