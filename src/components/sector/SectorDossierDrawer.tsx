// McKinsey-style sector dossier drawer.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ExternalLink } from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CopyButton } from "@/components/ui/copy-button";
import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { CitationSup } from "@/components/citations/CitationSup";
import { hostFromUrl, type CitableCitation } from "@/lib/citations/hygiene";
import type { CitationRef } from "@/components/citations/CitationSup";

function toRefs(list: CitableCitation[]): CitationRef[] {
  return list.map((c) => ({ n: c.n, url: c.url ?? undefined, title: c.title ?? undefined, org: c.org ?? undefined }));
}
import { buildSectorDossier, type SectorDossierResult } from "@/lib/sector-dossier/build.functions";

function fmtNum(v: number | null, unit?: string | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const formatted = abs >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

function fmtUsd(v: number | null) {
  if (v == null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

const pillarAccent: Record<"driver" | "risk" | "lever", string> = {
  driver: "border-emerald-400/50 bg-emerald-500/5",
  risk: "border-rose-400/50 bg-rose-500/5",
  lever: "border-indigo-400/50 bg-indigo-500/5",
};

export function SectorDossierDrawer({
  countryCode,
  sectorCode,
  onClose,
}: {
  countryCode: string;
  sectorCode: string | null;
  onClose: () => void;
}) {
  const fetchDossier = useServerFn(buildSectorDossier);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<SectorDossierResult>({
    queryKey: ["sector-dossier", countryCode, sectorCode],
    enabled: !!sectorCode,
    queryFn: () => (fetchDossier as any)({ data: { countryCode, sectorCode } }),
    staleTime: 5 * 60_000,
  });

  const open = !!sectorCode;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-2xl overflow-y-auto border-l border-line-200 bg-paper-0 p-0 sm:max-w-2xl"
      >
        {isLoading && (
          <div className="space-y-4 p-8">
            <div className="h-3 w-32 animate-pulse rounded bg-line-200" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-line-200" />
            <div className="h-4 w-full animate-pulse rounded bg-line-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-line-200" />
            <div className="h-24 w-full animate-pulse rounded bg-line-200" />
          </div>
        )}

        {isError && (
          <div className="p-8 text-sm text-signal-negative">
            Could not load sector brief: {(error as Error)?.message ?? "unknown error"}
          </div>
        )}

        {data && (
          <div className="space-y-8 p-8 pb-24">
            {/* Header */}
            <header className="space-y-2 border-b border-line-200 pb-6">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Sector dossier · {data.countryName}
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="flex items-center gap-1.5 rounded border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-700 transition hover:bg-paper-50 disabled:opacity-50"
                  title="Regenerate brief"
                >
                  <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
                  {data.cached ? "Refresh" : "Regenerate"}
                </button>
              </div>
              <h2 className="font-serif text-3xl leading-tight text-ink-950">{data.sectorLabel}</h2>
              {data.brief.headline && (
                <p className="font-serif text-lg italic text-ink-700">
                  <CitedMarkdown source={data.brief.headline} citations={toRefs(data.citations)} className="inline" />
                </p>
              )}
              {data.fallback && (
                <div className="mt-2 rounded border border-amber-400/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  AI brief unavailable — showing raw sector data. Try Regenerate.
                </div>
              )}
            </header>

            {/* Executive summary */}
            {data.brief.executive && (
              <section>
                <SectionHead label="Executive summary" copy={data.brief.executive} />
                <CitedMarkdown
                  source={data.brief.executive}
                  citations={toRefs(data.citations)}
                  className="prose prose-sm max-w-none font-serif text-[15px] leading-relaxed text-ink-800"
                />
              </section>
            )}

            {/* Stat strip */}
            <section className="grid grid-cols-2 gap-3 border-y border-line-200 py-4 md:grid-cols-4">
              <Stat label="Ministry" value={data.ministry?.name ?? "—"} />
              <Stat label="Minister" value={data.ministry?.minister ?? "—"} />
              <Stat label="KPIs tracked" value={String(data.kpis.length)} />
              <Stat label="Capital flows" value={String(data.flows.length)} />
            </section>

            {/* Pyramid */}
            {(data.brief.pyramid.situation || data.brief.pyramid.complication || data.brief.pyramid.resolution) && (
              <section>
                <SectionHead label="The pyramid" />
                <div className="space-y-3">
                  <PyramidRow tone="ink" label="Situation" body={data.brief.pyramid.situation} citations={toRefs(data.citations)} />
                  <PyramidRow tone="amber" label="Complication" body={data.brief.pyramid.complication} citations={toRefs(data.citations)} />
                  <PyramidRow tone="emerald" label="Resolution" body={data.brief.pyramid.resolution} citations={toRefs(data.citations)} />
                </div>
              </section>
            )}

            {/* Pillars */}
            {data.brief.pillars.length > 0 && (
              <section>
                <SectionHead label="Drivers, risks & levers" />
                <div className="grid gap-3 md:grid-cols-3">
                  {data.brief.pillars.map((p, i) => (
                    <div key={i} className={`rounded border p-3 ${pillarAccent[p.kind]}`}>
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">{p.title}</div>
                      <ul className="space-y-1.5">
                        {p.bullets.map((b, j) => (
                          <li key={j} className="text-[13px] leading-snug text-ink-800">
                            <CitedMarkdown source={`- ${b}`} citations={toRefs(data.citations)} className="inline [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0 [&_li]:m-0" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* KPIs */}
            {data.kpis.length > 0 && (
              <section>
                <SectionHead label="Linked KPIs" />
                <div className="rounded border border-line-200">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-line-200 bg-paper-50/50 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                        <th className="px-3 py-2 text-left">Indicator</th>
                        <th className="px-3 py-2 text-right">Latest</th>
                        <th className="px-3 py-2 text-right">Target</th>
                        <th className="px-3 py-2 text-left">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.kpis.map((k) => (
                        <tr key={k.kpi_code} className="border-b border-line-200 last:border-0">
                          <td className="px-3 py-2 text-ink-950">{k.label}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-800">{fmtNum(k.latest, k.unit)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-500">{fmtNum(k.target, k.unit)}</td>
                          <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-500">{k.direction ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Outlook */}
            {data.brief.outlook && (
              <section>
                <SectionHead label="Outlook (12–24 mo)" copy={data.brief.outlook} />
                <CitedMarkdown
                  source={data.brief.outlook}
                  citations={toRefs(data.citations)}
                  className="prose prose-sm max-w-none font-serif text-[15px] leading-relaxed text-ink-800"
                />
              </section>
            )}

            {/* Ministry / Mandate */}
            {data.ministry && (
              <section>
                <SectionHead label="Lead ministry" />
                <div className="rounded border border-line-200 bg-paper-50/30 p-4">
                  <div className="font-serif text-lg text-ink-950">{data.ministry.name}</div>
                  {data.ministry.minister && (
                    <div className="mt-1 text-sm text-ink-700">Minister · <span className="font-medium text-ink-950">{data.ministry.minister}</span></div>
                  )}
                  {data.ministry.mandate && (
                    <p className="mt-2 font-serif text-[14px] leading-relaxed text-ink-800">{data.ministry.mandate}</p>
                  )}
                </div>
              </section>
            )}

            {/* Capital flows */}
            {data.flows.length > 0 && (
              <section>
                <SectionHead label="Capital flows · sector footprint" />
                <ul className="space-y-2">
                  {data.flows.map((f, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 border-b border-line-200 pb-2 last:border-0">
                      <div className="min-w-0">
                        <span className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${f.direction === "in" ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>
                          {f.direction === "in" ? "In" : "Out"}
                        </span>
                        <span className="text-[13px] text-ink-950">{f.label}</span>
                        {f.note && <div className="mt-0.5 text-[11px] text-ink-500">{f.note}</div>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-sm tabular-nums text-ink-950">{fmtUsd(f.magnitude_usd)}</div>
                        {f.url && (
                          <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-500 hover:text-ink-950">
                            source <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sources */}
            {data.citations.length > 0 && (
              <section>
                <SectionHead label="Sources" />
                <ol className="space-y-1.5 text-[12px]">
                  {data.citations.map((c) => (
                    <li key={c.n} className="flex items-start gap-2">
                      <CitationSup n={c.n ?? 0} citation={toRefs([c])[0]} />
                      <div className="min-w-0 flex-1">
                        <a href={c.url ?? "#"} target="_blank" rel="noreferrer" className="text-ink-800 underline decoration-line-300 underline-offset-2 hover:text-ink-950">
                          {c.title ?? c.url}
                        </a>
                        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                          {hostFromUrl(c.url) ?? c.org ?? ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SectionHead({ label, copy }: { label: string; copy?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">{label}</div>
      {copy && <CopyButton value={copy} className="text-ink-500 hover:text-ink-950" />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="mt-0.5 truncate font-serif text-sm text-ink-950" title={value}>
        {value}
      </div>
    </div>
  );
}

function PyramidRow({
  label,
  body,
  tone,
  citations,
}: {
  label: string;
  body: string;
  tone: "ink" | "amber" | "emerald";
  citations: CitationRef[];
}) {
  if (!body) return null;
  const bar =
    tone === "amber"
      ? "bg-amber-400"
      : tone === "emerald"
        ? "bg-emerald-500"
        : "bg-ink-950";
  return (
    <div className="flex gap-3">
      <div className={`mt-1 w-1 shrink-0 rounded-full ${bar}`} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
        <CitedMarkdown
          source={body}
          citations={citations}
          className="mt-0.5 font-serif text-[15px] leading-relaxed text-ink-800"
        />
      </div>
    </div>
  );
}
