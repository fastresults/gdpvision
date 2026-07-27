import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Illustration } from "./Illustration";


interface ChamberPanelProps {
  index: string; // "01" .. "07"
  title: string;
  purpose: string;
  bullets: string[];
  /** CSS variable name for the leading accent bar hue, e.g. "--sector-03". */
  accentVar: string;
  /** Optional CDN URL for a real product screenshot rendered as the panel header. */
  image?: string;
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
  image,
  className,
}: ChamberPanelProps) {
  return (
    <article
      className={cn(
        "relative overflow-hidden bg-paper-0 min-h-[240px]",
        "border-t border-b border-line-200",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 z-10 h-full w-[2px]"
        style={{ background: `var(${accentVar})` }}
      />
      <div className="pl-6 pr-5 py-6">
        <div className="flex items-start justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
          <span className="pt-1">Chamber {index}</span>
          {image ? (
            <Illustration
              src={image}
              variant="mark"
              className="h-16 w-16 shrink-0 opacity-90 md:h-[72px] md:w-[72px]"
            />
          ) : null}
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
      </div>
    </article>
  );
}
