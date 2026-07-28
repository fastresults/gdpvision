import type { ChamberAlert } from "@/lib/executive/types";

/**
 * The micro read. Every alert this chamber raised — not the rail's top five —
 * with the deterministic arithmetic that ranked it, so the Principal never has
 * to trust a number they cannot audit.
 */
export function AwaitsList({ alerts }: { alerts: ChamberAlert[] }) {
  return (
    <section id="awaits" className="border-t border-line-200 pt-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">What awaits you</h2>
        <span data-numeric className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {alerts.length ? `${alerts.length} item${alerts.length === 1 ? "" : "s"}` : "nothing outstanding"}
        </span>
      </div>

      {alerts.length === 0 ? (
        <p className="mt-4 text-[15px] text-ink-500">
          Nothing in this chamber requires you. It is inside tolerance on every measure on record.
        </p>
      ) : (
        <ul className="mt-3 border-t border-line-100">
          {[...alerts]
            .sort((a, b) => b.severity - a.severity)
            .map((a, i) => (
              <li
                key={i}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-4 border-b border-line-100 py-3.5"
              >
                <span data-numeric className="shrink-0 font-mono text-[10px] tracking-[0.2em] text-ink-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15.5px] leading-snug text-ink-950">{a.text}</span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                    {a.because.join(" · ")}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
