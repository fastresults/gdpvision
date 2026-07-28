import { TempoSparkline } from "../TempoSparkline";
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
}: {
  tempo: number[];
  lastActivityAt: string | null;
  quiet: boolean;
}) {
  const total = tempo.reduce((a, b) => a + b, 0);
  const peak = Math.max(0, ...tempo);
  const peakDay = tempo.indexOf(peak);
  const daysAgo = tempo.length - 1 - peakDay;

  return (
    <section className="border-t border-line-200 pt-5">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Tempo · 30 days</h2>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
        <div className={quiet ? "text-ink-300" : "text-ink-950"}>
          <div className="h-[74px]">
            <TempoSparkline data={tempo} className="!h-[74px]" />
          </div>
          <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300">
            <span>30d ago</span>
            <span />
            <span>Today</span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-4 md:gap-3">
          <Stat label="Movements" value={total ? String(total) : "0"} />
          <Stat label="Since last" value={lastActivityAt ? relTime(lastActivityAt) : "—"} />
          <Stat
            label="Busiest"
            value={peak > 0 ? (daysAgo === 0 ? "today" : `${daysAgo}d ago`) : "—"}
          />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd data-numeric className="truncate font-serif text-[22px] leading-none text-ink-950">
        {value}
      </dd>
      <dt className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
        {label}
      </dt>
    </div>
  );
}
