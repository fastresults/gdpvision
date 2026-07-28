import type { ChamberSummary } from "@/lib/executive/types";
import { originOf } from "@/lib/executive/detail";
import { useExecutiveDetail } from "./DetailModal";
import { shortDate } from "./tone";

/** What is due — every chamber's next dated obligation, one calendar. */
export function DueLedger({ chambers }: { code?: string; chambers: ChamberSummary[] }) {
  const { open } = useExecutiveDetail();
  const horizon = Date.now() + 45 * 86_400_000;
  const rows = chambers
    .filter((c) => c.next_due?.at)
    .map((c) => ({ c, at: Date.parse(c.next_due!.at!) }))
    .filter((r) => !Number.isNaN(r.at) && r.at < horizon)
    .sort((a, b) => a.at - b.at);

  return (
    <section className="border-t border-line-200 pt-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">What is due</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">next 45 days</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-[14px] text-ink-500">Nothing dated in the next 45 days.</p>
      ) : (
        <ul className="mt-3">
          {rows.map(({ c, at }) => {
            const overdue = at < Date.now();
            return (
              <li key={c.index} className="border-b border-line-100 last:border-b-0">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() =>
                    open({
                      kind: "due",
                      ...originOf(c),
                      label: c.next_due!.label,
                      at: c.next_due!.at,
                      state: overdue ? "Overdue" : "Due",
                    })
                  }
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-baseline gap-4 py-2.5 text-left transition-colors hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 sm:grid-cols-[92px_120px_minmax(0,1fr)_auto]"
                >
                  <span
                    data-numeric
                    className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] ${
                      overdue ? "text-[var(--signal-negative)]" : "text-ink-950"
                    }`}
                  >
                    {shortDate(c.next_due!.at)}
                  </span>
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500 sm:block">
                    {c.title.replace(/^The\s+/, "")}
                  </span>
                  <span className="min-w-0 truncate text-[14.5px] text-ink-950">{c.next_due!.label}</span>
                  <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500 sm:block">
                    {c.owner}
                  </span>
                </button>

              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
