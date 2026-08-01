// Chamber 07 · Field desk · a disclosure that states its own contents.
//
// The bare <details> strip told the operator nothing: not what was inside, not
// whether anything was waiting, not whether it was the thing blocking them.
// This one carries an icon, a purpose, a live badge and a real chevron.

import { ChevronRight } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { Hint } from "./Hint";
import { cn } from "@/lib/utils";

export function Panel({
  icon: Icon,
  title,
  purpose,
  badge,
  hint,
  defaultOpen = false,
  attention = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  purpose: string;
  /** Right-hand state, e.g. "3 staged · 1 to check". */
  badge?: string;
  hint?: { what: string; then?: string };
  defaultOpen?: boolean;
  /** Marks the panel as the one currently wanting a decision. */
  attention?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <section className={cn("border bg-paper-0", attention ? "border-ink-950" : "border-line-200")}>
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-11 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-950"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-ink-500 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium leading-snug text-ink-950">{title}</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-600">{purpose}</span>
          </span>
          {badge ? (
            <span
              className={cn(
                "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums",
                attention
                  ? "border-ink-950 bg-ink-950 text-paper-0"
                  : "border-line-200 bg-paper-50 text-ink-600",
              )}
            >
              {badge}
            </span>
          ) : null}
        </button>
        {hint ? (
          <span className="mt-1 shrink-0">
            <Hint what={hint.what} {...(hint.then ? { then: hint.then } : {})} />
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="animate-in fade-in-0 slide-in-from-top-1 border-t border-line-100 p-3 duration-150">
          {children}
        </div>
      ) : null}
    </section>
  );
}
