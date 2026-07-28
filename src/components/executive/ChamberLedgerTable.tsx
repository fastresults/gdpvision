import { Link } from "@tanstack/react-router";

import type { ChamberSummary } from "@/lib/executive/types";
import { sheetRoute, slugForIndex, type ExecutiveSurface } from "@/lib/executive/chambers";
import { TONE_RULE, TONE_TEXT, relTime, shortDate } from "./tone";

/**
 * Ledger view — same eight chambers, sorted by next due date. Grid view is
 * for orientation; this is for triage. Same data, two mental models, no
 * navigation between them.
 */
export function ChamberLedgerTable({
  code,
  chambers,
  surface,
}: {
  code: string;
  chambers: ChamberSummary[];
  surface: ExecutiveSurface;
}) {
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
          {rows.map((c) => (
            <tr key={c.index} className="border-b border-line-100 transition-colors last:border-b-0 hover:bg-paper-100">
              <td className="w-1 p-0">
                <span className={`block h-full min-h-[44px] w-[3px] ${TONE_RULE[c.health]}`} />
              </td>
              <td className="px-4 py-3">
                <Link
                  to={sheetRoute(surface)}
                  params={{ code, chamber: slugForIndex(c.index) }}
                  className="group block min-w-0"
                >
                  <span data-numeric className="font-mono text-[9px] tracking-[0.2em] text-ink-500">
                    {c.index}
                  </span>
                  <span className="ml-2 font-serif text-[15px] text-ink-950 group-hover:underline">{c.title}</span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {c.kpis.slice(0, 3).map((k, i) => (
                    <span key={i} className="whitespace-nowrap">
                      <span data-numeric className={`font-serif text-[15px] ${TONE_TEXT[k.tone ?? "neutral"]}`}>
                        {k.value ?? "—"}
                      </span>
                      <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                        {k.label}
                      </span>
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{c.owner}</td>
              <td data-numeric className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                {c.last_activity_at ? relTime(c.last_activity_at) : "—"}
              </td>
              <td className="px-4 py-3">
                {c.next_due ? (
                  <span className="block min-w-0">
                    <span data-numeric className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-950">
                      {shortDate(c.next_due.at)}
                    </span>
                    <span className="ml-2 text-[12.5px] text-ink-500">{c.next_due.label}</span>
                  </span>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
