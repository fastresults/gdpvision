// Data-room index: one folder table per folder, status as coloured text.

import {
  DATA_ROOM_STATUS_LABEL,
  type DataRoomContent,
  type DataRoomStatus,
} from "@/lib/investments/package-schema";
import { cn } from "@/lib/utils";

import { GoldRule, Kicker, Sheet, formatDate } from "./parts";

const STATUS_CLASS: Record<DataRoomStatus, string> = {
  available: "text-signal-positive",
  to_provide: "text-signal-caution",
  restricted: "text-draft-state",
};

export function DataRoomLayout({ c }: { c: DataRoomContent }) {
  const all = c.folders.flatMap((f) => f.items);
  const count = (s: DataRoomStatus) => all.filter((i) => i.status === s).length;
  return (
    <Sheet className="pkg-dataroom">
      <GoldRule />
      <Kicker className="mt-5">Data-room index · {c.country_name}</Kicker>
      <h1 className="mt-3 font-display text-[30px] leading-[1.1] tracking-tight text-ink-950 print:text-[20pt]">
        {c.project_title}
      </h1>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
        Prepared {formatDate(c.prepared_on)}
      </div>
      <p className="mt-5 max-w-[72ch] text-[13.5px] leading-relaxed text-ink-950 print:text-[9.5pt]">
        {c.intro}
      </p>

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-y border-line-200 py-3">
        {(Object.keys(DATA_ROOM_STATUS_LABEL) as DataRoomStatus[]).map((s) => (
          <div key={s} className="flex items-baseline gap-2">
            <dt
              className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", STATUS_CLASS[s])}
            >
              {DATA_ROOM_STATUS_LABEL[s]}
            </dt>
            <dd className="font-display text-[18px] leading-none text-ink-950" data-numeric>
              {count(s)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 space-y-8 print:mt-5 print:space-y-5">
        {c.folders.map((f) => (
          <section
            key={f.number}
            className="pkg-dataroom-folder"
            aria-labelledby={`folder-${f.number}`}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-gold-500">{f.number}</span>
              <h2
                id={`folder-${f.number}`}
                className="font-display text-[19px] text-ink-950 print:text-[13pt]"
              >
                {f.title}
              </h2>
            </div>
            <div className="mt-2 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12px] leading-snug print:min-w-0 print:text-[8.5pt]">
                <thead>
                  <tr className="border-b border-ink-950/60">
                    {["Ref", "Document", "Standard", "Required", "Status", "Note"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="py-1.5 pr-3 align-bottom font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ink-500 last:pr-0"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {f.items.map((it) => (
                    <tr key={it.ref} className="border-b border-line-200 align-top">
                      <td className="py-1.5 pr-3 font-mono text-[10.5px] text-ink-500">{it.ref}</td>
                      <td className="py-1.5 pr-3 text-ink-950">{it.name}</td>
                      <td className="py-1.5 pr-3 text-ink-700">{it.standard}</td>
                      <td className="py-1.5 pr-3 text-ink-700">
                        {it.required ? "Required" : "If applicable"}
                      </td>
                      <td className={cn("py-1.5 pr-3 font-medium", STATUS_CLASS[it.status])}>
                        {DATA_ROOM_STATUS_LABEL[it.status]}
                      </td>
                      <td className="py-1.5 text-ink-700">{it.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
