import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock } from "lucide-react";

import type { ChamberSummary } from "@/lib/executive/types";
import { sheetRoute, slugForIndex, type ExecutiveSurface } from "@/lib/executive/chambers";
import { kpiDetail, originOf } from "@/lib/executive/detail";
import { KpiTriple } from "./KpiTriple";
import { TempoSparkline } from "./TempoSparkline";
import { useExecutiveDetail } from "./DetailModal";
import { TONE_RULE, TONE_TEXT, relTime, shortDate } from "./tone";

/**
 * One anatomy for all eight chambers: 3 KPIs, tempo, last activity, next due.
 * The card face navigates to the room sheet; every individual figure and
 * activity line opens its own detail modal.
 */
export function ChamberCard({
  code,
  chamber,
  index,
  surface,
}: {
  code: string;
  chamber: ChamberSummary;
  index: number;
  surface: ExecutiveSurface;
}) {
  const quiet = chamber.health === "quiet";
  const idle = relTime(chamber.last_activity_at);
  const { open } = useExecutiveDetail();
  const origin = originOf(chamber);

  return (
    <div
      style={{ animationDelay: `${index * 45}ms` }}
      className="group relative flex min-h-[228px] flex-col justify-between border-b border-r border-line-200 bg-card p-5 transition-colors hover:bg-paper-100 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both"
    >
      <Link
        to={sheetRoute(surface)}
        params={{ code, chamber: slugForIndex(chamber.index) }}
        aria-label={`Open the ${chamber.title} room sheet`}
        className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
      />
      <span className={`absolute inset-x-0 top-0 h-px ${TONE_RULE[chamber.health]}`} aria-hidden />

      <div className="pointer-events-none relative z-10 min-w-0">
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
          <KpiTriple kpis={chamber.kpis} onSelect={(k) => open(kpiDetail(k, origin))} />
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-5">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => open({ kind: "chamber", chamber })}
          className={`pointer-events-auto block w-full text-left ${quiet ? "text-ink-300" : "text-ink-950"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500`}
        >
          <TempoSparkline data={chamber.tempo} />
        </button>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-line-100 pt-2">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() =>
              open(
                chamber.recent[0]
                  ? { kind: "activity", ...origin, at: chamber.recent[0].at, text: chamber.recent[0].text }
                  : { kind: "chamber", chamber },
              )
            }
            className="pointer-events-auto truncate text-left font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500 transition-colors hover:text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
          >
            {chamber.last_activity_at ? `Last activity ${idle}` : `No activity — 30 days+`}
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() =>
              open({
                kind: "due",
                ...origin,
                label: chamber.next_due?.label ?? "Nothing scheduled",
                at: chamber.next_due?.at ?? null,
                state: chamber.next_due ? "Due" : "Open",
              })
            }
            className={`pointer-events-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors hover:text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 ${chamber.next_due ? TONE_TEXT.neutral : "text-ink-300"}`}
          >
            {chamber.next_due ? `Due ${shortDate(chamber.next_due.at)}` : "—"}
          </button>
        </div>
      </div>

      {/* Progressive disclosure: recent lines + owning office, on hover/focus */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-1 border-t border-ink-950/10 bg-paper-0/97 p-4 opacity-0 backdrop-blur-[2px] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">{chamber.owner}</p>
        <ul className="mt-2 space-y-1.5">
          {chamber.recent.length === 0 && (
            <li className="text-[12px] text-ink-300">— not yet on record</li>
          )}
          {chamber.recent.slice(0, 3).map((r, i) => (
            <li key={i}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => open({ kind: "activity", ...origin, at: r.at, text: r.text })}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 text-left transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <span data-numeric className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                  {relTime(r.at)}
                </span>
                <span className="truncate text-[12.5px] text-ink-950">{r.text}</span>
              </button>
            </li>
          ))}
        </ul>
        <Link
          to={sheetRoute(surface)}
          params={{ code, chamber: slugForIndex(chamber.index) }}
          className="mt-3 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-950 hover:underline"
        >
          Open the room sheet <ArrowUpRight size={11} strokeWidth={1.5} />
        </Link>
      </div>

      {chamber.next_due?.at && (
        <span className="sr-only">
          <Clock size={10} /> Next due {shortDate(chamber.next_due.at)} — {chamber.next_due.label}
        </span>
      )}
    </div>
  );
}
