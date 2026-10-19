// Method & licences: the indicator tree as the runner reads it, and the licence
// checklist that gates publication. Read-only by design: the method is versioned
// and changes only by migration, so editions stay comparable.

import { useMemo, useState } from "react";

import type { IndicesOverview } from "@/lib/indices/review.functions";
import { Eyebrow, INDEX_CODES, Section, Tag, type IndexCode } from "./shared";

export function MethodTab({
  o,
  licenceOnly,
  setLicenceOnly,
}: {
  o: IndicesOverview;
  licenceOnly: boolean;
  setLicenceOnly: (v: boolean) => void;
}) {
  const [index, setIndex] = useState<IndexCode>("CGX");

  const publishers = useMemo(() => {
    const m = new Map<
      string,
      { org: string; licence: string; status: string; indicators: string[]; active: number }
    >();
    for (const i of o.indicators) {
      const k = `${i.source_org}|${i.licence}|${i.licence_status}`;
      const e = m.get(k) ?? {
        org: i.source_org,
        licence: i.licence,
        status: i.licence_status,
        indicators: [],
        active: 0,
      };
      e.indicators.push(`${i.index_code}.${i.code}`);
      if (i.status === "active") e.active++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) =>
      a.status === b.status ? b.active - a.active : a.status === "to_confirm" ? -1 : 1,
    );
  }, [o.indicators]);

  const spec = o.specs.find((s) => s.code === index)!;
  const pillars = o.pillars.filter((p) => p.index_code === index);
  const inds = o.indicators.filter(
    (i) => i.index_code === index && (!licenceOnly || i.licence_status !== "confirmed"),
  );
  const toConfirm = publishers.filter((p) => p.status !== "confirmed");

  return (
    <>
      <Section title="Licences">
        <p className="max-w-3xl text-sm text-ink-500">
          Only public, licensed data enters a score. An edition cannot be published while any input
          it uses comes from a source whose licence is still <em>to confirm</em>. Confirm the
          publisher’s terms (or buy a licence), then record it in a migration that sets{" "}
          <code className="font-mono text-xs">licence_status = 'confirmed'</code>.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Publisher</th>
                <th className="py-2 font-normal">Licence</th>
                <th className="py-2 font-normal">Status</th>
                <th className="py-2 text-right font-normal">Active indicators</th>
              </tr>
            </thead>
            <tbody>
              {publishers.map((p) => (
                <tr
                  key={`${p.org}|${p.licence}|${p.status}`}
                  className="border-b border-line-200/60 align-top"
                >
                  <td className="py-1.5">{p.org}</td>
                  <td className="py-1.5 text-ink-700">{p.licence}</td>
                  <td className="py-1.5">
                    <Tag tone={p.status === "confirmed" ? "good" : p.active ? "bad" : "warn"}>
                      {p.status === "confirmed" ? "confirmed" : "to confirm"}
                    </Tag>
                  </td>
                  <td
                    className="py-1.5 text-right font-mono tabular-nums"
                    title={p.indicators.join(", ")}
                  >
                    {p.active}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {toConfirm.length > 0 && (
          <p className="mt-3 text-xs text-ink-700">
            {toConfirm.length} publisher licence{toConfirm.length === 1 ? "" : "s"} to confirm. Rows
            marked “to confirm” with active indicators block publication of any edition that uses
            them.
          </p>
        )}
      </Section>

      <Section
        title="Method"
        aside={
          <label className="flex items-center gap-2 text-xs text-ink-700">
            <input
              type="checkbox"
              checked={licenceOnly}
              onChange={(e) => setLicenceOnly(e.target.checked)}
            />
            Only indicators with a licence to confirm
          </label>
        }
      >
        <div className="flex flex-wrap gap-2">
          {INDEX_CODES.map((c) => (
            <button
              key={c}
              type="button"
              className={index === c ? "btn-primary" : "btn-secondary"}
              onClick={() => setIndex(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {spec && (
          <div className="mt-3">
            <h3 className="font-serif text-lg">{spec.name}</h3>
            <p className="text-sm text-ink-500">
              {spec.question} Benchmark: {spec.benchmark}. Method v{spec.method_version},{" "}
              <strong className="font-normal text-ink-950">{spec.method_status}</strong>.
            </p>
          </div>
        )}

        {pillars.map((p) => {
          const rows = inds.filter((i) => i.pillar_code === p.code);
          if (!rows.length) return null;
          return (
            <div key={p.code} className="mt-6">
              <Eyebrow>
                Pillar · {p.name} · weight {p.weight}
              </Eyebrow>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full table-fixed text-xs" data-numeric>
                  <thead>
                    <tr className="border-b border-line-200 text-left uppercase tracking-widest text-ink-500">
                      <th className="w-[22%] py-2 font-normal">Indicator</th>
                      <th className="w-[20%] py-2 font-normal">Source</th>
                      <th className="w-[11%] py-2 text-right font-normal">Worst → best</th>
                      <th className="w-[8%] py-2 pl-3 font-normal">Window</th>
                      <th className="w-[7%] py-2 text-right font-normal">Max age</th>
                      <th className="w-[11%] py-2 pl-3 font-normal">Type</th>
                      <th className="w-[13%] py-2 font-normal">Licence</th>
                      <th className="w-[8%] py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <tr key={i.code} className="border-b border-line-200/60 align-top">
                        <td className="py-1.5">
                          {i.name}
                          <span className="block font-mono text-[10px] text-ink-500">
                            {i.code}
                            {i.unit ? ` · ${i.unit}` : ""}
                          </span>
                          {i.notes && (
                            <span className="block text-[11px] text-ink-500">{i.notes}</span>
                          )}
                        </td>
                        <td className="py-1.5">
                          {i.source_url ? (
                            <a
                              href={i.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {i.source_org}
                            </a>
                          ) : (
                            i.source_org
                          )}
                          <span className="block font-mono text-[10px] text-ink-500">
                            {i.source_kind}
                            {i.source_code ? ` · ${i.source_code}` : ""}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono tabular-nums">
                          {i.goal_worst} → {i.goal_best}
                          {i.log_scale ? " (log)" : ""}
                        </td>
                        <td className="py-1.5 pl-3">{i.window_kind.replace("_", " ")}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {i.age_tolerance_years} y
                        </td>
                        <td className="py-1.5 pl-3">{i.indicator_type.replace("_", " ")}</td>
                        <td className="py-1.5">
                          <span className="text-ink-700">{i.licence}</span>{" "}
                          <Tag tone={i.licence_status === "confirmed" ? "good" : "warn"}>
                            {i.licence_status === "confirmed" ? "ok" : "to confirm"}
                          </Tag>
                        </td>
                        <td className="py-1.5">
                          <Tag tone={i.status === "active" ? "good" : "quiet"}>
                            {i.status === "active" ? "live" : "pending source"}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {inds.length === 0 && (
          <p className="mt-4 text-sm text-ink-500">
            Every indicator on this index has a confirmed licence.
          </p>
        )}

        <div className="mt-8 border-l-2 border-line-200 pl-3 text-sm text-ink-700">
          <Eyebrow>Changing the method</Eyebrow>
          <p className="mt-1">
            Goalposts, weights, sources and licences change only by migration, so every edition is
            reproducible and comparable. Bump{" "}
            <code className="font-mono text-xs">method_version</code> with any change. The
            methodology panel ratifies the goalposts, then a migration sets{" "}
            <code className="font-mono text-xs">method_status = 'frozen'</code> at least 30 days
            before an edition’s data cut-off.
          </p>
        </div>
      </Section>
    </>
  );
}
