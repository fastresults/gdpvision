import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock } from "lucide-react";

import type { ChamberSummary } from "@/lib/executive/types";
import { KpiTriple } from "./KpiTriple";
import { TempoSparkline } from "./TempoSparkline";
import { TONE_RULE, TONE_TEXT, relTime, shortDate } from "./tone";

/**
 * One anatomy for all eight chambers: 3 KPIs, tempo, last activity, next due.
 * Hover raises the three most recent activity lines and the owning office.
 * Once the Principal reads one card, they can read all eight.
 */
export function ChamberCard({
  code,
  chamber,
  index,
}: {
  code: string;
  chamber: ChamberSummary;
  index: number;
}) {
  const quiet = chamber.health === "quiet";
  const idle = relTime(chamber.last_activity_at);

  return (
    <Link
      to={chamber.to}
      params={{ code }}
      style={{ animationDelay: `${index * 45}ms` }}
      className="group relative flex min-h-[228px] flex-col justify-between border-b border-r border-line-200 bg-card p-5 transition-colors hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both"
    >
      <span className={`absolute inset-x-0 top-0 h-px ${TONE_RULE[chamber.health]}`} aria-hidden />

      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-500">
              Chamber {chamber.index}
            </p>
            <h3 className={`mt-1.5 truncate font-serif text-[19px] leading-tight ${quiet ? "text-ink-300" : "text-ink-950"}`}>
              {chamber.title}
            </h3>
          </div>
          <span data-numeric className="shrink-0 font-serif text-[28px] leading-none text-line-200">
            {chamber.index}
          </span>
        </div>

        <div className="mt-5">
          <KpiTriple kpis={chamber.kpis} />
        </div>
      </div>

      <div className="mt-5">
        <div className={quiet ? "text-ink-300" : "text-ink-950"}>
          <TempoSparkline data={chamber.tempo} />
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-line-100 pt-2">
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
            {chamber.last_activity_at ? `Last activity ${idle}` : `No activity — 30 days+`}
          </span>
          <span className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] ${chamber.next_due ? TONE_TEXT.neutral : "text-ink-300"}`}>
            {chamber.next_due ? `Due ${shortDate(chamber.next_due.at)}` : "—"}
          </span>
        </div>
      </div>

      {/* Progressive disclosure: recent lines + owning office, on hover/focus */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 border-t border-ink-950/10 bg-paper-0/97 p-4 opacity-0 backdrop-blur-[2px] transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">{chamber.owner}</p>
        <ul className="mt-2 space-y-1.5">
          {chamber.recent.length === 0 && (
            <li className="text-[12px] text-ink-300">— not yet on record</li>
          )}
          {chamber.recent.map((r, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2">
              <span data-numeric className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                {relTime(r.at)}
              </span>
              <span className="truncate text-[12.5px] text-ink-950">{r.text}</span>
            </li>
          ))}
        </ul>
        <span className="mt-3 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-950">
          Enter chamber <ArrowUpRight size={11} strokeWidth={1.5} />
        </span>
      </div>

      {chamber.next_due?.at && (
        <span className="sr-only">
          <Clock size={10} /> Next due {shortDate(chamber.next_due.at)} — {chamber.next_due.label}
        </span>
      )}
    </Link>
  );
}
