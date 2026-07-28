import type { ActivityLine, NextDue } from "@/lib/executive/types";
import { relTime, shortDate } from "../tone";

/**
 * Deliverables and dates — the paper trail. What is coming, then what has
 * already moved. Same order on all eight sheets.
 */
export function DeliverablesTable({
  owner,
  nextDue,
  recent,
}: {
  owner: string;
  nextDue: NextDue | null;
  recent: ActivityLine[];
}) {
  return (
    <section className="border-t border-line-200 pt-5">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Deliverables &amp; dates</h2>

      <div className="mt-3 border-t border-line-100">
        <Row
          when={nextDue?.at ? shortDate(nextDue.at) : "—"}
          what={nextDue?.label ?? "Nothing scheduled"}
          who={owner}
          state={nextDue ? "Due" : "Open"}
          muted={!nextDue}
        />
      </div>

      <h3 className="mt-7 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Recent movement</h3>
      {recent.length === 0 ? (
        <p className="mt-3 text-[14px] text-ink-300">— not yet on record</p>
      ) : (
        <ol className="mt-3 border-t border-line-100">
          {recent.map((r, i) => (
            <li
              key={i}
              className="grid grid-cols-[86px_minmax(0,1fr)] items-baseline gap-4 border-b border-line-100 py-2.5"
            >
              <span data-numeric className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                {relTime(r.at)}
              </span>
              <span className="min-w-0 text-[14px] leading-snug text-ink-950">{r.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Row({
  when,
  what,
  who,
  state,
  muted,
}: {
  when: string;
  what: string;
  who: string;
  state: string;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-line-100 py-3">
      <span data-numeric className={`font-mono text-[10px] uppercase tracking-[0.16em] ${muted ? "text-ink-300" : "text-ink-950"}`}>
        {when}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-[14.5px] ${muted ? "text-ink-300" : "text-ink-950"}`}>{what}</span>
        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{who}</span>
      </span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{state}</span>
    </div>
  );
}
