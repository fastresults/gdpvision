import type { ActivityLine, NextDue } from "@/lib/executive/types";
import type { DetailOrigin } from "@/lib/executive/detail";
import { useExecutiveDetail } from "../DetailModal";
import { relTime, shortDate } from "../tone";

/**
 * Deliverables and dates — the paper trail. What is coming, then what has
 * already moved. Every line is a record the Principal can open.
 */
export function DeliverablesTable({
  owner,
  nextDue,
  recent,
  origin,
}: {
  owner: string;
  nextDue: NextDue | null;
  recent: ActivityLine[];
  origin: DetailOrigin;
}) {
  const { open } = useExecutiveDetail();

  return (
    <section className="border-t border-line-200 pt-5">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Deliverables &amp; dates</h2>

      <div className="mt-3 border-t border-line-100">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() =>
            open({
              kind: "due",
              ...origin,
              label: nextDue?.label ?? "Nothing scheduled",
              at: nextDue?.at ?? null,
              state: nextDue ? "Due" : "Open",
            })
          }
          className="grid w-full grid-cols-[86px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-line-100 py-3 text-left transition-colors hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
        >
          <span
            data-numeric
            className={`font-mono text-[10px] uppercase tracking-[0.16em] ${nextDue ? "text-ink-950" : "text-ink-300"}`}
          >
            {nextDue?.at ? shortDate(nextDue.at) : "—"}
          </span>
          <span className="min-w-0">
            <span className={`block truncate text-[14.5px] ${nextDue ? "text-ink-950" : "text-ink-300"}`}>
              {nextDue?.label ?? "Nothing scheduled"}
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{owner}</span>
          </span>
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            {nextDue ? "Due" : "Open"}
          </span>
        </button>
      </div>

      <h3 className="mt-7 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Recent movement</h3>
      {recent.length === 0 ? (
        <p className="mt-3 text-[14px] text-ink-300">— not yet on record</p>
      ) : (
        <ol className="mt-3 border-t border-line-100">
          {recent.map((r, i) => (
            <li key={i} className="border-b border-line-100">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => open({ kind: "activity", ...origin, at: r.at, text: r.text })}
                className="grid w-full grid-cols-[86px_minmax(0,1fr)] items-baseline gap-4 py-2.5 text-left transition-colors hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <span data-numeric className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  {relTime(r.at)}
                </span>
                <span className="min-w-0 text-[14px] leading-snug text-ink-950">{r.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
