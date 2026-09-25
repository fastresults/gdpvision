import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3 } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import {
  ExecutivePerspectiveProvider,
  type ExecutivePerspective,
  useExecutivePerspective,
} from "@/components/home/ExecutivePerspective";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBlocEconomicSummary,
  type BlocEconomicSummary,
  type BlocKey,
  type BlocMetric,
  type BlocSummary,
  type BlocTrend,
} from "@/lib/caricom.functions";
import { cn } from "@/lib/utils";
import "@/lib/explain/caricom-entries";

export type BlocSummaryTab = BlocKey | "compare";

export function BlocSummaryButton({
  bloc,
  onOpen,
}: {
  bloc: BlocKey;
  onOpen: (bloc: BlocKey) => void;
}) {
  const label = bloc === "caricom" ? "CARICOM" : "OECS";
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(bloc);
      }}
      className="btn-ghost h-8 w-8 border-l border-line-200 p-0"
      aria-label={`View ${label} economic summary`}
      title={`View ${label} economic summary`}
    >
      <BarChart3 size={14} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

export function BlocEconomicSummaryModal({
  open,
  activeBloc,
  onOpenChange,
  onBlocChange,
}: {
  open: boolean;
  activeBloc: BlocSummaryTab;
  onOpenChange: (open: boolean) => void;
  onBlocChange: (bloc: BlocSummaryTab) => void;
}) {
  const fetchSummary = useServerFn(getBlocEconomicSummary);
  const { data, isPending, error } = useQuery({
    queryKey: ["bloc-economic-summary", 2],
    queryFn: () => fetchSummary(),
    enabled: open,
    staleTime: 30 * 60_000,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-line-200 bg-paper-0 p-0 sm:max-w-[min(92vw,980px)]"
      >
        <SheetHeader className="border-b border-line-200 px-6 py-6 pr-14 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
            Regional instrument
          </p>
          <SheetTitle className="font-serif text-3xl font-normal text-ink-950">
            Summary economic data
          </SheetTitle>
          <SheetDescription className="max-w-2xl text-sm leading-relaxed text-ink-500">
            Comparable public readings for two overlapping Caribbean blocs. CARICOM and OECS are not
            mutually exclusive groups.
          </SheetDescription>
        </SheetHeader>

        {isPending ? (
          <SummarySkeleton />
        ) : error || !data ? (
          <SummaryError />
        ) : (
          <ExecutivePerspectiveProvider>
            <Tabs
              value={activeBloc}
              onValueChange={(value) => onBlocChange(value as BlocSummaryTab)}
            >
              <div className="sticky top-0 z-10 border-b border-line-200 bg-paper-0 px-6 py-3 sm:px-8">
                <TabsList className="grid h-11 w-full grid-cols-3 rounded-none bg-paper-100 p-1">
                  {(["caricom", "oecs"] as BlocKey[]).map((key) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="rounded-none font-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:shadow-none"
                    >
                      {data.blocs[key].label}
                      <span className="ml-2 text-ink-500" data-numeric>
                        {data.blocs[key].memberCount}
                      </span>
                    </TabsTrigger>
                  ))}
                  <TabsTrigger
                    value="compare"
                    className="rounded-none font-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:shadow-none"
                  >
                    Compare
                  </TabsTrigger>
                </TabsList>
              </div>
              {(["caricom", "oecs"] as BlocKey[]).map((key) => (
                <TabsContent key={key} value={key} className="m-0 p-6 sm:p-8">
                  <BlocSummaryView
                    active={data.blocs[key]}
                    reference={data.blocs[key === "caricom" ? "oecs" : "caricom"]}
                    data={data}
                  />
                </TabsContent>
              ))}
              <TabsContent value="compare" className="m-0 p-6 sm:p-8">
                <BlocComparisonView caricom={data.blocs.caricom} oecs={data.blocs.oecs} />
              </TabsContent>
            </Tabs>
          </ExecutivePerspectiveProvider>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BlocComparisonView({ caricom, oecs }: { caricom: BlocSummary; oecs: BlocSummary }) {
  const oecsByKey = new Map(oecs.metrics.map((metric) => [metric.key, metric]));

  return (
    <div className="space-y-8">
      <section className="border-b border-line-200 pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Side-by-side comparison
        </p>
        <h2 className="mt-1 font-serif text-3xl text-ink-950">Economic categories</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Each row uses one shared scale, making the two bloc readings directly comparable.
        </p>
      </section>

      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)] border border-line-200">
        <div className="bg-paper-50 p-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
          Category
        </div>
        <div className="border-l border-line-200 bg-paper-50 p-3 text-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bloc-caricom">
            CARICOM
          </span>
          <span className="ml-1 text-[9px] text-ink-500">{caricom.memberCount}</span>
        </div>
        <div className="border-l border-line-200 bg-paper-50 p-3 text-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bloc-oecs">
            OECS
          </span>
          <span className="ml-1 text-[9px] text-ink-500">{oecs.memberCount}</span>
        </div>

        {caricom.metrics.map((caricomMetric) => {
          const oecsMetric = oecsByKey.get(caricomMetric.key);
          if (!oecsMetric) return null;
          const maximum = Math.max(
            Math.abs(caricomMetric.value ?? 0),
            Math.abs(oecsMetric.value ?? 0),
            1,
          );
          return (
            <ComparisonCategoryRow
              key={caricomMetric.key}
              caricom={caricomMetric}
              oecs={oecsMetric}
              maximum={maximum}
            />
          );
        })}
      </div>

      <section className="border-l-2 border-gold-500 bg-paper-50 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Reading the table
        </p>
        <Explain id="caricom.bloc-gap" className="mt-2 block">
          <p className="text-sm leading-relaxed text-ink-700">
            Compare scale measures separately from rates and burdens. A longer bar is not always
            stronger: lower debt and unemployment may be preferable, while larger GDP mainly
            indicates economic scale.
          </p>
        </Explain>
      </section>
    </div>
  );
}

function ComparisonCategoryRow({
  caricom,
  oecs,
  maximum,
}: {
  caricom: BlocMetric;
  oecs: BlocMetric;
  maximum: number;
}) {
  const perspective = metricPerspective(caricom, oecs, "caricom", "comparison");
  const interaction = useExecutivePerspective(perspective);
  return (
    <div
      {...interaction}
      className="col-span-3 grid grid-cols-subgrid outline-none transition-colors data-[perspective-active=true]:bg-paper-100"
    >
      <div className="border-t border-line-200 p-3 outline-none transition-colors data-[perspective-active=true]:bg-paper-100 sm:p-4">
        <p className="text-xs font-medium text-ink-950 sm:text-sm">{caricom.label}</p>
        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-500 sm:text-[9px]">
          {caricom.method}
        </p>
      </div>
      <ComparisonValueCell metric={caricom} maximum={maximum} bloc="caricom" />
      <ComparisonValueCell metric={oecs} maximum={maximum} bloc="oecs" />
    </div>
  );
}

function ComparisonValueCell({
  metric,
  maximum,
  bloc,
}: {
  metric: BlocMetric;
  maximum: number;
  bloc: BlocKey;
}) {
  const width = metric.value == null ? 0 : Math.max(2, (Math.abs(metric.value) / maximum) * 100);
  return (
    <div className="min-w-0 border-l border-t border-line-200 p-3 text-center sm:p-4">
      <Explain id="caricom.bloc-summary" ctx={{ metric }}>
        <strong
          className="block font-serif text-base font-normal text-ink-950 sm:text-xl"
          data-numeric
        >
          {metric.available ? formatMetric(metric.value, metric.unit) : "—"}
        </strong>
      </Explain>
      <div className="mx-auto mt-2 h-1.5 max-w-40 bg-paper-100" aria-hidden>
        <div
          className={cn("h-full", bloc === "caricom" ? "bloc-fill-caricom" : "bloc-fill-oecs")}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-500">
        {metric.coverage}/{metric.eligible} · {metric.period}
      </p>
    </div>
  );
}

function BlocSummaryView({
  active,
  reference,
  data,
}: {
  active: BlocSummary;
  reference: BlocSummary;
  data: BlocEconomicSummary;
}) {
  const headline = active.metrics.slice(0, 3);
  const performance = active.metrics.slice(3);
  const referenceByKey = useMemo(
    () => new Map(reference.metrics.map((metric) => [metric.key, metric])),
    [reference.metrics],
  );
  const availableCount = active.metrics.filter((metric) => metric.available).length;

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-line-200 pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            {active.memberCount} members and associates
          </p>
          <h2 className="mt-1 font-serif text-3xl text-ink-950">{active.label} economic profile</h2>
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          <div>
            {availableCount} of {active.metrics.length} indicators available
          </div>
          <div>Refreshed {formatDate(active.updatedAt ?? data.generatedAt)}</div>
        </div>
      </section>

      <section aria-labelledby={`${active.key}-scale`}>
        <SectionHeading
          id={`${active.key}-scale`}
          eyebrow="Economic scale"
          title="The bloc in aggregate"
        />
        <div className="mt-4 grid gap-px border border-line-200 bg-line-200 md:grid-cols-3">
          {headline.map((metric) => (
            <HeadlineMetric
              key={metric.key}
              metric={metric}
              reference={referenceByKey.get(metric.key)}
              active={active.key}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={`${active.key}-performance`}>
        <SectionHeading
          id={`${active.key}-performance`}
          eyebrow="Economic performance"
          title="Rates, burdens and capacity"
        />
        <div className="mt-4 divide-y divide-line-200 border-y border-line-200">
          {performance.map((metric) => (
            <BulletMetric
              key={metric.key}
              metric={metric}
              reference={referenceByKey.get(metric.key)}
              active={active.key}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={`${active.key}-momentum`}>
        <SectionHeading
          id={`${active.key}-momentum`}
          eyebrow="Momentum"
          title="Comparable observations over time"
        />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {active.trends.map((trend) => (
            <TrendChart
              key={trend.key}
              trend={trend}
              reference={reference.trends.find((item) => item.key === trend.key)}
              active={active.key}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={`${active.key}-distribution`}>
        <SectionHeading
          id={`${active.key}-distribution`}
          eyebrow="Member distribution"
          title="What sits behind the bloc reading"
        />
        <div className="mt-4 space-y-6">
          {performance.slice(0, 4).map((metric) => (
            <Distribution key={metric.key} metric={metric} active={active.key} />
          ))}
        </div>
      </section>

      <Interpretation active={active} reference={reference} />
    </div>
  );
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">{eyebrow}</p>
      <h3 id={id} className="mt-1 font-serif text-xl text-ink-950">
        {title}
      </h3>
    </div>
  );
}

function HeadlineMetric({
  metric,
  reference,
  active,
}: {
  metric: BlocMetric;
  reference?: BlocMetric;
  active: BlocKey;
}) {
  const max = Math.max(metric.value ?? 0, reference?.value ?? 0, 1);
  const perspective = metricPerspective(metric, reference, active, "headline");
  const interaction = useExecutivePerspective(perspective);
  return (
    <article
      {...interaction}
      className="min-w-0 bg-paper-0 p-5 outline-none transition-colors data-[perspective-active=true]:bg-paper-100"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
        {metric.label}
      </p>
      <Explain id="caricom.bloc-summary" ctx={{ metric }} className="mt-2 block">
        <strong className="font-serif text-3xl font-normal text-ink-950" data-numeric>
          {metric.available ? formatMetric(metric.value, metric.unit) : "—"}
        </strong>
      </Explain>
      <ComparisonBar
        value={metric.value}
        reference={reference?.value ?? null}
        max={max}
        active={active}
      />
      <MetricMeta metric={metric} />
    </article>
  );
}

function BulletMetric({
  metric,
  reference,
  active,
}: {
  metric: BlocMetric;
  reference?: BlocMetric;
  active: BlocKey;
}) {
  const values = [metric.value, reference?.value].filter((value): value is number => value != null);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = Math.max(max - min, 1);
  const start = ((0 - min) / span) * 100;
  const end = metric.value == null ? start : ((metric.value - min) / span) * 100;
  const ref = reference?.value == null ? null : ((reference.value - min) / span) * 100;
  const perspective = metricPerspective(metric, reference, active, "performance");
  const interaction = useExecutivePerspective(perspective);
  return (
    <div
      {...interaction}
      className="grid gap-3 px-2 py-5 outline-none transition-colors data-[perspective-active=true]:bg-paper-100 md:grid-cols-[190px_minmax(0,1fr)_130px] md:items-center"
    >
      <div>
        <p className="text-sm font-medium text-ink-950">{metric.label}</p>
        <MetricMeta metric={metric} />
      </div>
      <div className="relative h-7 bg-paper-100" aria-hidden>
        <div className="absolute inset-y-0 w-px bg-ink-300" style={{ left: `${start}%` }} />
        {metric.value != null ? (
          <div
            className={cn(
              "absolute top-1/2 h-3 -translate-y-1/2",
              active === "caricom" ? "bloc-fill-caricom" : "bloc-fill-oecs",
            )}
            style={{
              left: `${Math.min(start, end)}%`,
              width: `${Math.max(Math.abs(end - start), 1)}%`,
            }}
          />
        ) : null}
        {ref != null ? (
          <div className="absolute inset-y-1 w-0.5 bg-ink-700" style={{ left: `${ref}%` }} />
        ) : null}
      </div>
      <div className="md:text-right">
        <Explain id="caricom.bloc-summary" ctx={{ metric }}>
          <span className="font-serif text-xl text-ink-950" data-numeric>
            {metric.available ? formatMetric(metric.value, metric.unit) : "Unavailable"}
          </span>
        </Explain>
        {reference?.value != null ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
            Other bloc {formatMetric(reference.value, metric.unit)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ComparisonBar({
  value,
  reference,
  max,
  active,
}: {
  value: number | null;
  reference: number | null;
  max: number;
  active: BlocKey;
}) {
  const width = value == null ? 0 : Math.max(2, (Math.abs(value) / max) * 100);
  const ref = reference == null ? null : (Math.abs(reference) / max) * 100;
  return (
    <div className="relative mt-4 h-3 bg-paper-100" aria-hidden>
      <div
        className={cn(
          "absolute inset-y-0 left-0",
          active === "caricom" ? "bloc-fill-caricom" : "bloc-fill-oecs",
        )}
        style={{ width: `${width}%` }}
      />
      {ref != null ? (
        <div className="absolute -inset-y-1 w-0.5 bg-ink-700" style={{ left: `${ref}%` }} />
      ) : null}
    </div>
  );
}

function MetricMeta({ metric }: { metric: BlocMetric }) {
  return (
    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
      {metric.method} · {metric.coverage}/{metric.eligible} · {metric.period}
    </p>
  );
}

function TrendChart({
  trend,
  reference,
  active,
}: {
  trend: BlocTrend;
  reference?: BlocTrend;
  active: BlocKey;
}) {
  const all = [...trend.points, ...(reference?.points ?? [])];
  const perspective = trendPerspective(trend, reference, active);
  const interaction = useExecutivePerspective(perspective);
  if (trend.points.length < 3)
    return (
      <article
        {...interaction}
        className="border border-line-200 p-4 outline-none transition-colors data-[perspective-active=true]:bg-paper-100"
      >
        <p className="text-sm font-medium text-ink-950">{trend.label}</p>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
          Current reading only
        </p>
      </article>
    );
  const min = Math.min(...all.map((point) => point.value));
  const max = Math.max(...all.map((point) => point.value));
  const years = [...new Set(all.map((point) => point.year))].sort();
  const firstYear = years[0] ?? 0;
  const lastYear = years.at(-1) ?? firstYear;
  const path = (points: BlocTrend["points"]) =>
    points
      .map((point, index) => {
        const x =
          years.length <= 1 ? 50 : ((point.year - firstYear) / (lastYear - firstYear)) * 100;
        const y = max === min ? 40 : 72 - ((point.value - min) / (max - min)) * 56;
        return `${index ? "L" : "M"}${x},${y}`;
      })
      .join(" ");
  return (
    <article
      {...interaction}
      className="border border-line-200 p-4 outline-none transition-colors data-[perspective-active=true]:bg-paper-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-950">{trend.label}</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
            Median · {trend.points.at(-1)?.coverage}/{trend.points.at(-1)?.eligible}
          </p>
        </div>
        <span className="font-serif text-lg" data-numeric>
          {formatMetric(trend.points.at(-1)?.value ?? null, trend.unit)}
        </span>
      </div>
      <svg
        viewBox="0 0 100 82"
        className="mt-4 h-24 w-full overflow-visible"
        role="img"
        aria-label={`${trend.label} trend`}
      >
        <path
          d={path(reference?.points ?? [])}
          fill="none"
          className="stroke-ink-300"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <path
          d={path(trend.points)}
          fill="none"
          className={active === "caricom" ? "stroke-bloc-caricom" : "stroke-bloc-oecs"}
          strokeWidth="2.5"
        />
      </svg>
      <div className="flex justify-between font-mono text-[9px] text-ink-500">
        <span>{firstYear}</span>
        <span>{lastYear}</span>
      </div>
    </article>
  );
}

function Distribution({ metric, active }: { metric: BlocMetric; active: BlocKey }) {
  const values = metric.distribution.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const middle = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
  const position = (value: number) => (max === min ? 50 : ((value - min) / (max - min)) * 100);
  const perspective = distributionPerspective(metric, active, middle, min, max);
  const interaction = useExecutivePerspective(perspective);
  if (!metric.distribution.length) return null;
  return (
    <article
      {...interaction}
      className="px-2 py-1 outline-none transition-colors data-[perspective-active=true]:bg-paper-100"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-950">{metric.label}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
          {metric.distribution.length} members · median {formatMetric(middle, metric.unit)}
        </p>
      </div>
      <div className="relative mt-3 h-9 border-y border-line-200 bg-paper-50">
        <div
          className="absolute inset-y-0 w-px bg-ink-300"
          style={{ left: `${position(middle)}%` }}
        />
        {metric.distribution.map((point) => (
          <a
            key={point.code}
            href={point.sourceUrl ?? undefined}
            target={point.sourceUrl ? "_blank" : undefined}
            rel={point.sourceUrl ? "noreferrer" : undefined}
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-0 focus-visible:h-4 focus-visible:w-4",
              active === "caricom" ? "bg-bloc-caricom" : "bg-bloc-oecs",
            )}
            style={{ left: `${position(point.value)}%` }}
            aria-label={`${point.name}: ${formatMetric(point.value, metric.unit)}, ${point.period}`}
          />
        ))}
      </div>
    </article>
  );
}

function Interpretation({ active, reference }: { active: BlocSummary; reference: BlocSummary }) {
  const comparisons = active.metrics
    .flatMap((metric) => {
      const other = reference.metrics.find((item) => item.key === metric.key);
      if (metric.value == null || other?.value == null) return [];
      const denominator = Math.max(Math.abs(other.value), 0.01);
      return [
        {
          label: metric.label,
          difference: (metric.value - other.value) / denominator,
          value: metric.value,
          other: other.value,
          unit: metric.unit,
        },
      ];
    })
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  const scale = comparisons.find((item) => item.label === "Combined GDP");
  const strongest = comparisons.find((item) => item.label !== "Combined GDP");
  return (
    <section className="border-l-2 border-gold-500 bg-paper-50 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        What this comparison means
      </p>
      <Explain id="caricom.bloc-gap" className="mt-2 block">
        <div className="space-y-2 text-sm leading-relaxed text-ink-700">
          {scale ? (
            <p>
              {active.label}'s combined GDP is {Math.abs(scale.difference * 100).toFixed(0)}%{" "}
              {scale.difference >= 0 ? "larger" : "smaller"} than {reference.label}'s covered total.
            </p>
          ) : null}
          {strongest ? (
            <p>
              The widest available rate gap is {strongest.label.toLowerCase()}:{" "}
              {formatMetric(strongest.value, strongest.unit)} versus{" "}
              {formatMetric(strongest.other, strongest.unit)}.
            </p>
          ) : null}
          <p>
            Read the member dot strips before treating any bloc-wide result as uniform across its
            economies.
          </p>
        </div>
      </Explain>
    </section>
  );
}

const BURDEN_KEYS = new Set(["debt_gdp", "unemployment_rate"]);

function blocLabel(bloc: BlocKey): string {
  return bloc === "caricom" ? "CARICOM" : "OECS";
}

function metricRelevance(metric: BlocMetric): string {
  const relevance: Record<string, string> = {
    gdp: "Economic scale shapes market capacity and the resources potentially available to governments and firms.",
    population:
      "Population indicates the size of the shared labour, consumer and public-service base.",
    exports_of_goods_and_services:
      "Export intensity shows exposure to external demand and the importance of foreign earnings.",
    real_gdp_growth:
      "Growth indicates current economic momentum, but should be read alongside volatility and the member distribution.",
    gdp_per_capita_current_usd:
      "GDP per person is a broad capacity measure, not a direct measure of household income or inclusion.",
    debt_gdp:
      "Debt burden can constrain fiscal room, although financing terms and maturity also matter.",
    fdi_net_inflows_gdp:
      "FDI inflows indicate external investment relative to economic size and may expand productive capacity.",
    current_account_gdp:
      "The current account reflects the balance between external receipts and payments and can signal financing pressure.",
    unemployment_rate:
      "Unemployment indicates unused labour capacity and pressure on household welfare and public finances.",
  };
  return (
    relevance[metric.key] ??
    "Use this measure with its period, coverage and member spread when assessing the bloc."
  );
}

function comparisonText(
  metric: BlocMetric,
  reference: BlocMetric | undefined,
  active: BlocKey,
): string {
  if (metric.value == null || reference?.value == null) {
    return "A reliable side-by-side bloc comparison is unavailable at the current coverage threshold.";
  }
  const difference = metric.value - reference.value;
  const denominator = Math.max(Math.abs(reference.value), 0.01);
  const percentage = Math.abs((difference / denominator) * 100);
  const direction =
    Math.abs(difference) < 0.005 ? "approximately level with" : difference > 0 ? "above" : "below";
  const preference = BURDEN_KEYS.has(metric.key)
    ? " For this burden measure, a lower reading is generally preferable."
    : " A higher reading is not automatically a stronger outcome without context.";
  return `${blocLabel(active)} is ${percentage.toFixed(0)}% ${direction} ${blocLabel(active === "caricom" ? "oecs" : "caricom")} on the covered reading.${preference}`;
}

function memberText(metric: BlocMetric): string {
  if (!metric.distribution.length)
    return "No member-level distribution is available for this measure.";
  const values = metric.distribution.map((point) => point.value).sort((a, b) => a - b);
  const medianValue = values[Math.floor(values.length / 2)] ?? 0;
  const min = values[0] ?? 0;
  const max = values.at(-1) ?? 0;
  return `${metric.distribution.length} member readings span ${formatMetric(min, metric.unit)} to ${formatMetric(max, metric.unit)}, with a median of ${formatMetric(medianValue, metric.unit)}.`;
}

function metricPerspective(
  metric: BlocMetric,
  reference: BlocMetric | undefined,
  active: BlocKey,
  surface: "headline" | "performance" | "comparison",
): ExecutivePerspective {
  const current = metric.available ? formatMetric(metric.value, metric.unit) : "unavailable";
  return {
    id: `${surface}-${active}-${metric.key}`,
    title: metric.label,
    summary: `${blocLabel(active)} records ${current} for ${metric.label.toLowerCase()} using the displayed ${metric.method}.`,
    comparison: comparisonText(metric, reference, active),
    trend:
      "This visual is a current comparison. Use the dedicated trend chart where comparable historical observations are available.",
    members: memberText(metric),
    relevance: metricRelevance(metric),
    caution: `${metric.coverage} of ${metric.eligible} eligible members are covered for ${metric.period}. The bloc reading uses a ${metric.method} and should not be treated as uniform across members.`,
  };
}

function trendPerspective(
  trend: BlocTrend,
  reference: BlocTrend | undefined,
  active: BlocKey,
): ExecutivePerspective {
  const first = trend.points[0];
  const latest = trend.points.at(-1);
  const change = first && latest ? latest.value - first.value : null;
  const direction =
    change == null
      ? "unavailable"
      : Math.abs(change) < 0.005
        ? "broadly stable"
        : change > 0
          ? "rising"
          : "falling";
  const referenceLatest = reference?.points.at(-1);
  const referenceText =
    latest && referenceLatest
      ? `${blocLabel(active)}'s latest reading is ${formatMetric(Math.abs(latest.value - referenceLatest.value), trend.unit)} ${latest.value >= referenceLatest.value ? "above" : "below"} the other bloc.`
      : "The other bloc does not have a comparable latest trend reading.";
  const metric = { key: trend.key } as BlocMetric;
  return {
    id: `trend-${active}-${trend.key}`,
    title: `${trend.label} trend`,
    summary: latest
      ? `${blocLabel(active)}'s latest median is ${formatMetric(latest.value, trend.unit)} in ${latest.year}.`
      : "No comparable historical trend is available.",
    comparison: referenceText,
    trend:
      first && latest
        ? `The covered median is ${direction}, changing by ${formatMetric(Math.abs(change ?? 0), trend.unit)} from ${first.year} to ${latest.year}.`
        : "Fewer than three comparable observations are available, so no direction is asserted.",
    members: latest
      ? `${latest.coverage} of ${latest.eligible} members contribute to the latest point.`
      : "Member coverage is insufficient for a trend reading.",
    relevance: metricRelevance(metric),
    caution:
      "The line joins annual bloc medians. It describes observed direction, not a forecast, and its member mix can change between years.",
  };
}

function distributionPerspective(
  metric: BlocMetric,
  active: BlocKey,
  medianValue: number,
  minimum: number,
  maximum: number,
): ExecutivePerspective {
  return {
    id: `distribution-${active}-${metric.key}`,
    title: `${metric.label} member distribution`,
    summary: `${blocLabel(active)} member readings range from ${formatMetric(minimum, metric.unit)} to ${formatMetric(maximum, metric.unit)}.`,
    comparison:
      "This strip compares members within the selected bloc; use the Compare tab for the direct CARICOM–OECS reading.",
    trend:
      "The strip is a cross-section of current readings and does not imply movement over time.",
    members: `The median is ${formatMetric(medianValue, metric.unit)} across ${metric.distribution.length} covered members. Wider spacing signals greater variation within the bloc.`,
    relevance: metricRelevance(metric),
    caution: `${metric.coverage} of ${metric.eligible} eligible members are covered for ${metric.period}. Small and large economies have equal visual weight in this distribution.`,
  };
}

function SummarySkeleton() {
  return (
    <div className="space-y-6 p-8" aria-label="Loading economic summary">
      <div className="h-11 animate-pulse bg-paper-100" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse bg-paper-100" />
        ))}
      </div>
      <div className="h-72 animate-pulse bg-paper-100" />
    </div>
  );
}
function SummaryError() {
  return (
    <div className="p-8">
      <p className="font-serif text-2xl text-ink-950">Summary unavailable</p>
      <p className="mt-2 text-sm text-ink-500">
        The comparable economic records could not be loaded. Close this panel and try again.
      </p>
    </div>
  );
}
function formatDate(value: string | null): string {
  if (!value) return "not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "not recorded"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function formatMetric(value: number | null, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "USD") {
    const abs = Math.abs(value);
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (unit === "people") {
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return `${value.toFixed(2)}${unit.includes("%") ? "%" : ` ${unit}`}`;
}
