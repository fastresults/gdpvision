import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Printer } from "lucide-react";

import type { ChamberSummary } from "@/lib/executive/types";
import { briefRoute, type ExecutiveSurface } from "@/lib/executive/chambers";
import { TONE_TEXT, relTime } from "../tone";
import { KpiTriple } from "../KpiTriple";
import { TempoPanel } from "./TempoPanel";
import { AwaitsList } from "./AwaitsList";
import { DeliverablesTable } from "./DeliverablesTable";

/**
 * The Chamber Room Sheet. One screen between the brief and the working
 * chamber: macro numbers, work rhythm, everything awaiting the Principal, and
 * the paper trail — then exactly one way in.
 */
export function ChamberSheet({
  code,
  chamber,
  surface,
}: {
  code: string;
  chamber: ChamberSummary;
  surface: ExecutiveSurface;
}) {
  const quiet = chamber.health === "quiet";
  const awaiting = chamber.alerts.length;
  const verdict = awaiting
    ? `${awaiting} item${awaiting === 1 ? "" : "s"} await${awaiting === 1 ? "s" : ""} your decision.`
    : quiet
      ? "Quiet — no work recorded in this chamber for 30 days."
      : "Steady — nothing in this chamber awaits you.";

  return (
    <div className="chamber-sheet pb-28 md:pb-0">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_264px] md:gap-10">
        <div className="min-w-0 space-y-7">
          {/* ── Sheet head ─────────────────────────────────────────────── */}
          <header>
            <Link
              to={briefRoute(surface)}
              params={{ code }}
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500 transition-colors hover:text-ink-950 print:hidden"
            >
              <ArrowLeft size={11} strokeWidth={1.5} /> Executive brief
            </Link>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-500">
                  Chamber {chamber.index} · {chamber.owner}
                </p>
                <h1 className={`mt-2 font-serif text-[34px] leading-[1.08] sm:text-[40px] ${quiet ? "text-ink-300" : "text-ink-950"}`}>
                  {chamber.title}
                </h1>
              </div>
              <span data-numeric className="shrink-0 font-serif text-[52px] leading-none text-line-200">
                {chamber.index}
              </span>
            </div>

            <p className={`mt-4 text-[17px] leading-snug ${awaiting ? TONE_TEXT[chamber.health] : "text-ink-500"}`}>
              {verdict}
            </p>

            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-300">
              {chamber.last_activity_at
                ? `Last activity ${relTime(chamber.last_activity_at)}`
                : "No activity — 30 days+"}
            </p>
          </header>

          {/* ── Macro band ─────────────────────────────────────────────── */}
          <section className="border-y border-ink-950 py-5">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">The numbers</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {chamber.kpis.map((k, i) => (
                <div key={`${k.label}-${i}`} className="min-w-0">
                  <div
                    data-numeric
                    className={`truncate font-serif text-[34px] leading-none ${TONE_TEXT[k.tone ?? "neutral"]}`}
                    title={k.value ?? "not yet on record"}
                  >
                    {k.value ?? <span className="text-ink-300">—</span>}
                  </div>
                  <div className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.18em] text-ink-500">
                    {k.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <TempoPanel tempo={chamber.tempo} lastActivityAt={chamber.last_activity_at} quiet={quiet} />

          <AwaitsList alerts={chamber.alerts} />

          <DeliverablesTable owner={chamber.owner} nextDue={chamber.next_due} recent={chamber.recent} />
        </div>

        {/* ── Actions: right column on desktop, sticky footer on mobile ── */}
        <aside className="hidden md:block print:hidden">
          <div className="sticky top-24 space-y-4 border border-line-200 bg-card p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">Ready to work</p>
            <p className="text-[13.5px] leading-snug text-ink-500">
              This sheet is the read. The chamber is where the decision is taken and recorded.
            </p>
            <Link
              to={chamber.to}
              params={{ code }}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              Enter the chamber <ArrowUpRight size={13} strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-ghost inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              <Printer size={12} strokeWidth={1.5} /> Print sheet
            </button>
            <div className="border-t border-line-100 pt-3">
              <KpiTriple kpis={chamber.kpis} size="sm" />
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[72px] z-20 border-t border-line-200 bg-paper-0/95 p-3 backdrop-blur md:hidden print:hidden">
        <Link
          to={chamber.to}
          params={{ code }}
          className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
        >
          Enter the chamber <ArrowUpRight size={13} strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}
