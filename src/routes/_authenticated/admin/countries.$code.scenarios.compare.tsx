import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { X } from "lucide-react";

import { getScenario } from "@/lib/scenarios.functions";
import type { EngineOutput } from "@/lib/engine/v1_macro";
import { readPins, writePins } from "./countries.$code.scenarios";

const Search = z.object({
  ids: z.string().optional().default(""),
});

export const Route = createFileRoute("/_authenticated/admin/countries/$code/scenarios/compare")({
  head: ({ params }) => ({
    meta: [
      { title: `Compare scenarios · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => Search.parse(s),
  component: Compare,
});

const PALETTE = ["--sector-01", "--sector-06", "--sector-04", "--sector-09"];

function Compare() {
  const { code } = Route.useParams();
  const search = Route.useSearch();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const fromSearch = search.ids
      ? search.ids.split(",").filter(Boolean)
      : readPins(code);
    setIds(fromSearch.slice(0, 4));
  }, [code, search.ids]);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["scenario-artifact", id],
      queryFn: () => getScenario({ data: { id } }),
    })),
  });

  const loaded = queries
    .map((q, i) => ({ id: ids[i], data: q.data }))
    .filter((x) => x.data);

  function unpin(id: string) {
    const next = ids.filter((x) => x !== id);
    setIds(next);
    writePins(code, next);
    window.dispatchEvent(new Event("chamber03:pins"));
  }

  const overlay = useMemo(() => {
    const runs = loaded
      .map((s) => s.data!.results as EngineOutput | Record<string, never>)
      .filter((r): r is EngineOutput => "years" in r);
    if (runs.length === 0) return null;
    const years = runs[0].years;
    const allVals = runs.flatMap((r) => r.gdpGrowthPath.map((p) => p.p50));
    const min = Math.min(...allVals, 0) - 0.3;
    const max = Math.max(...allVals) + 0.3;
    return { runs, years, min, max };
  }, [loaded]);

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Chamber 03 · Compare
          </p>
          <h2 className="mt-2 font-serif text-3xl text-ink-950">
            Side by side · {loaded.length}/4
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Pinned scenarios overlay their P50 GDP path. Pin more from the artifact view.
          </p>
        </div>
        <Link
          to="/admin/countries/$code/scenarios"
          params={{ code }}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:text-ink-950"
        >
          ← Back to list
        </Link>
      </header>

      {loaded.length === 0 ? (
        <p className="mt-8 border border-line-200 p-6 text-sm text-ink-500">
          No scenarios pinned. Open a scenario and choose <em>Pin</em> to add it here.
        </p>
      ) : (
        <>
          <section className="mt-8 border border-line-200 bg-paper-0 p-6">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              P50 GDP growth overlay
            </h3>
            {overlay && (
              <svg
                viewBox="0 0 640 240"
                className="mt-4 w-full"
                role="img"
                aria-label="GDP growth overlay"
              >
                {(() => {
                  const w = 640;
                  const h = 240;
                  const pad = { l: 36, r: 12, t: 12, b: 28 };
                  const range = overlay.max - overlay.min || 1;
                  const x = (i: number) =>
                    pad.l + (i / Math.max(1, overlay.years.length - 1)) * (w - pad.l - pad.r);
                  const y = (v: number) =>
                    pad.t + (1 - (v - overlay.min) / range) * (h - pad.t - pad.b);
                  return (
                    <>
                      <line
                        x1={pad.l}
                        x2={w - pad.r}
                        y1={y(0)}
                        y2={y(0)}
                        stroke="var(--line-200)"
                      />
                      {overlay.years.map((yr, i) => (
                        <text
                          key={yr}
                          x={x(i)}
                          y={h - 8}
                          textAnchor="middle"
                          className="fill-ink-500 font-mono text-[9px]"
                        >
                          {yr}
                        </text>
                      ))}
                      {overlay.runs.map((r, idx) => {
                        const d = r.gdpGrowthPath
                          .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.p50)}`)
                          .join(" ");
                        return (
                          <path
                            key={idx}
                            d={d}
                            fill="none"
                            stroke={`var(${PALETTE[idx % PALETTE.length]})`}
                            strokeWidth={2}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            )}
            <ul className="mt-4 flex flex-wrap gap-4 text-xs">
              {loaded.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-4"
                    style={{ backgroundColor: `var(${PALETTE[i % PALETTE.length]})` }}
                  />
                  <span>{s.data!.title}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="mt-8 grid gap-4"
            style={{ gridTemplateColumns: `repeat(${loaded.length}, minmax(0,1fr))` }}
          >
            {loaded.map((s) => {
              const r = s.data!.results as EngineOutput | Record<string, never>;
              const y1 = "years" in r ? r.gdpGrowthPath[0]?.p50 ?? 0 : 0;
              const yE =
                "years" in r
                  ? r.gdpGrowthPath[r.gdpGrowthPath.length - 1]?.p50 ?? 0
                  : 0;
              return (
                <article key={s.id} className="border border-line-200 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                        {s.data!.status}
                      </p>
                      <h4 className="mt-1 line-clamp-2 font-serif text-base text-ink-950">
                        {s.data!.title}
                      </h4>
                    </div>
                    <button
                      onClick={() => unpin(s.id)}
                      aria-label="Unpin"
                      className="text-ink-500 hover:text-ink-950"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <dl className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between border-t border-line-200 pt-2">
                      <dt className="text-ink-500">Y1 P50</dt>
                      <dd className="font-mono tabular-nums">
                        {y1 >= 0 ? "+" : ""}
                        {y1.toFixed(2)}%
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-line-200 pt-2">
                      <dt className="text-ink-500">
                        Y{s.data!.horizon_years} P50
                      </dt>
                      <dd className="font-mono tabular-nums">
                        {yE >= 0 ? "+" : ""}
                        {yE.toFixed(2)}%
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-line-200 pt-2">
                      <dt className="text-ink-500">Levers moved</dt>
                      <dd className="font-mono tabular-nums">
                        {Object.keys(s.data!.lever_settings).length}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    to="/admin/countries/$code/scenarios/$id"
                    params={{ code, id: s.id }}
                    className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4"
                  >
                    Open →
                  </Link>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
