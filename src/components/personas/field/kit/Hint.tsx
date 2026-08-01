// Chamber 07 · Field desk · the instruction affordance.
//
// `Explain` answers "why is this number this number". `Hint` answers the other
// question an operator has at a control: "what will this do, and what happens
// after I press it". Hover, keyboard focus and touch all reach it, and it
// disappears in print — a procedure record should read as prose, not as UI.

import { HelpCircle } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

export function Hint({
  children,
  what,
  then: thenText,
  side = "top",
  className,
}: {
  /** What the control is. Omit to render the standalone `?` mark. */
  children?: ReactNode;
  /** One sentence: what pressing this does. */
  what: string;
  /** Optional second sentence: what happens next. */
  then?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const coarse = useCoarsePointer();
  const id = useId();

  const trigger = children ?? (
    <HelpCircle
      aria-hidden
      className="inline h-3.5 w-3.5 shrink-0 align-[-0.15em] text-ink-400 transition-colors group-hover:text-ink-700"
    />
  );

  return (
    <TooltipProvider delayDuration={coarse ? 0 : 180}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-describedby={open ? id : undefined}
            aria-label={children ? undefined : `Help — ${what}`}
            onClick={(e) => {
              if (!coarse) return;
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }}
            className={cn(
              "group inline-flex cursor-help items-center gap-1 align-baseline focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-950 focus-visible:ring-offset-2 print:hidden",
              className,
            )}
          >
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent
          id={id}
          side={side}
          sideOffset={6}
          className="max-w-[19rem] rounded-none border border-ink-800 bg-ink-950 px-3 py-2 text-left text-[12px] leading-relaxed text-paper-0 print:hidden"
        >
          <span className="block">{what}</span>
          {thenText ? <span className="mt-1 block text-paper-100/80">{thenText}</span> : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The `?` mark, placed after a label. */
export function HintMark(props: { what: string; then?: string; side?: "top" | "right" | "bottom" | "left" }) {
  return <Hint {...props} className="ml-1" />;
}
