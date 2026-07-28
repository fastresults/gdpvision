import type { ChamberSummary } from "@/lib/executive/types";
import { TempoSparkline } from "../TempoSparkline";
import { useExecutiveDetail } from "../DetailModal";
import { relTime } from "../tone";

/**
 * The macro read of work rhythm: 30 days of institutional activity, plus the
 * three numbers a Principal actually asks about — how much, how recent, how
 * concentrated.
 */
export function TempoPanel({
  tempo,
  lastActivityAt,
  quiet,
  chamber,
}: {
  tempo: number[];
  lastActivityAt: string | null;
  quiet: boolean;
  chamber: ChamberSummary;
}) {
  const { open } = useExecutiveDetail();
  const total = tempo.reduce((a, b) => a + b, 0);
  const peak = Math.max(0, ...tempo);
  const peakDay = tempo.indexOf(peak);
  const daysAgo = tempo.length - 1 - peakDay;

  return (
    <section className="border-t border-line-200 pt-5">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Tempo · 30 days</h2>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => open({ kind: "chamber", chamber })}
          className={`block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 ${quiet ? "text-ink-300" : "text-ink-950"}`}
        >
          <div className="h-[74px]">
            <TempoSparkline data={tempo} className="!h-[74px]" />
          </div>
          <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300">
            <span>30d ago</span>
            <span />
            <span>Today</span>
          </div>
        </button>

        <dl className="grid grid-cols-3 gap-4 md:gap-3">
          <Stat
            label="Movements"
            value={total ? String(total) : "0"}
            onClick={() =>
              open({
                kind: "kpi",
                index: chamber.index,
                title: chamber.title,
                owner: chamber.owner,
                label: "Movements · 30 days",
                value: total ? String(total) : "0",
                note: "Recorded institutional movements in this chamber over the last thirty days.",
              })
            }
          />
          <Stat
            label="Since last"
            value={lastActivityAt ? relTime(lastActivityAt) : "—"}
            onClick={() =>
              open(
                chamber.recent[0]
                  ? {
                      kind: "activity",
                      index: chamber.index,
                      title: chamber.title,
                      owner: chamber.owner,
                      at: chamber.recent[0].at,
                      text: chamber.recent[0].text,
                    }
                  : { kind: "chamber", chamber },
              )
            }
          />
          <Stat
            label="Busiest"
            value={peak > 0 ? (daysAgo === 0 ? "today" : `${daysAgo}d ago`) : "—"}
            onClick={() =>
              open({
                kind: "kpi",
                index: chamber.index,
                title: chamber.title,
                owner: chamber.owner,
                label: "Busiest day",
                value: peak > 0 ? `${peak} movements` : "—",
                note: "The single heaviest day of recorded activity inside the thirty-day window.",
              })
            }
          />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className="min-w-0 text-left transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
    >
      <dd data-numeric className="truncate font-serif text-[22px] leading-none text-ink-950">
        {value}
      </dd>
      <dt className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
        {label}
      </dt>
    </button>
  );
}
