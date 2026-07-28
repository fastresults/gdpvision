import type { ChamberSummary } from "@/lib/executive/types";
import type { ExecutiveSurface } from "@/lib/executive/chambers";
import { kpiDetail, originOf } from "@/lib/executive/detail";
import { useExecutiveDetail } from "./DetailModal";
import { TONE_RULE, TONE_TEXT, relTime, shortDate } from "./tone";

/**
 * Ledger view — same eight chambers, sorted by next due date. Grid view is
 * for orientation; this is for triage. Every cell opens its own detail modal.
 */
export function ChamberLedgerTable({
  chambers,
}: {
  code?: string;
  chambers: ChamberSummary[];
  surface?: ExecutiveSurface;
}) {
  const { open } = useExecutiveDetail();
  const rows = [...chambers].sort((a, b) => {
    const at = a.next_due?.at ? Date.parse(a.next_due.at) : Infinity;
    const bt = b.next_due?.at ? Date.parse(b.next_due.at) : Infinity;
    return at - bt;
  });

  return (
    <div className="overflow-x-auto border border-line-200">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink-950">
            {["", "Chamber", "Numbers", "Owner", "Last activity", "Next due"].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 font-mono text-[9px] font-normal uppercase tracking-[0.2em] text-ink-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const origin = originOf(c);
            return (
              <tr key={c.index} className="border-b border-line-100 transition-colors last:border-b-0 hover:bg-paper-100">
                <td className="w-1 p-0">
                  <span className={`block h-full min-h-[44px] w-[3px] ${TONE_RULE[c.health]}`} />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => open({ kind: "chamber", chamber: c })}
                    className="group block min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
                  >
                    <span data-numeric className="font-mono text-[9px] tracking-[0.2em] text-ink-500">
                      {c.index}
                    </span>
                    <span className="ml-2 font-serif text-[15px] text-ink-950 group-hover:underline">{c.title}</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    {c.kpis.slice(0, 3).map((k, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => open(kpiDetail(k, origin))}
                        className="whitespace-nowrap transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
                      >
                        <span data-numeric className={`font-serif text-[15px] ${TONE_TEXT[k.tone ?? "neutral"]}`}>
                          {k.value ?? "—"}
                        </span>
                        <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                          {k.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{c.owner}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() =>
                      open(
                        c.recent[0]
                          ? { kind: "activity", ...origin, at: c.recent[0].at, text: c.recent[0].text }
                          : { kind: "chamber", chamber: c },
                      )
                    }
                    data-numeric
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
                  >
                    {c.last_activity_at ? relTime(c.last_activity_at) : "—"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() =>
                      open({
                        kind: "due",
                        ...origin,
                        label: c.next_due?.label ?? "Nothing scheduled",
                        at: c.next_due?.at ?? null,
                        state: c.next_due ? "Due" : "Open",
                      })
                    }
                    className="block min-w-0 text-left transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
                  >
                    {c.next_due ? (
                      <>
                        <span data-numeric className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-950">
                          {shortDate(c.next_due.at)}
                        </span>
                        <span className="ml-2 text-[12.5px] text-ink-500">{c.next_due.label}</span>
                      </>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
