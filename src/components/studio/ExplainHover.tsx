import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export type ExplainCopy = {
  title: string;
  what: string;
  why: string;
  how: string;
};

type Props = {
  copy: ExplainCopy;
  children: React.ReactNode;
  delayMs?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  asChild?: boolean;
};

/**
 * Wraps any child so that hovering for `delayMs` (default 3500ms) opens
 * a McKinsey-tone popover explaining what the element is, why it matters,
 * and how it factors into the FDI resilience analysis.
 *
 * Uses Radix HoverCard's built-in openDelay for pointer, and mirrors the
 * same delay for keyboard focus. Closes instantly on leave/blur/Escape.
 */
export function ExplainHover({
  copy,
  children,
  delayMs = 3500,
  side = "top",
  align = "center",
  className,
  asChild = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const focusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFocusTimer = () => {
    if (focusTimer.current) {
      clearTimeout(focusTimer.current);
      focusTimer.current = null;
    }
  };

  React.useEffect(() => () => clearFocusTimer(), []);

  return (
    <HoverCard openDelay={delayMs} closeDelay={80} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        asChild={asChild}
        onFocus={() => {
          clearFocusTimer();
          focusTimer.current = setTimeout(() => setOpen(true), delayMs);
        }}
        onBlur={() => {
          clearFocusTimer();
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clearFocusTimer();
            setOpen(false);
          }
        }}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className={cn(
          "w-[340px] rounded-none border border-line-200 bg-paper-0 p-0 text-ink-950 shadow-lg",
          className,
        )}
      >
        <div className="border-b border-line-200 px-4 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">
            What you're looking at
          </p>
          <p className="mt-0.5 font-serif text-[15px] leading-snug text-ink-950">{copy.title}</p>
        </div>
        <div className="space-y-3 px-4 py-3 text-[12.5px] leading-relaxed text-ink-800">
          <Section eyebrow="What it is" body={copy.what} />
          <Section eyebrow="Why it matters" body={copy.why} />
          <Section eyebrow="How it's used" body={copy.how} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Section({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">{eyebrow}</p>
      <p className="mt-0.5 text-ink-800">{body}</p>
    </div>
  );
}
