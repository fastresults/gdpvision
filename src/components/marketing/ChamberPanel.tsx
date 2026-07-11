import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChamberPanelProps {
  index: string; // "01" .. "06"
  title: string;
  purpose: string;
  bullets: string[];
  /** CSS variable name for the leading accent bar hue, e.g. "--sector-03". */
  accentVar: string;
  children?: ReactNode;
  className?: string;
}

// Paper panel: borderless white body, hairline separators, 2px leading
// sector-hue accent bar (PRD §10.5). No filled header, no reverse-out.
export function ChamberPanel({
  index,
  title,
  purpose,
  bullets,
  accentVar,
  className,
}: ChamberPanelProps) {
  return (
    <article
      className={cn(
        "relative bg-paper-0 pl-6 pr-5 py-6 min-h-[240px]",
        "border-t border-b border-line-200",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ background: `var(${accentVar})` }}
      />
      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
        <span>Chamber {index}</span>
      </div>
      <h3 className="mt-3 font-serif text-[27px] leading-tight text-ink-950">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{purpose}</p>
      <ul className="mt-5 space-y-2.5 text-[13.5px] leading-relaxed text-ink-700">
        {bullets.map((b) => (
          <li key={b} className="flex gap-3">
            <span
              aria-hidden
              className="mt-2 inline-block h-[1px] w-4 flex-none"
              style={{ background: `var(${accentVar})` }}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
