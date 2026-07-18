import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Clock, Landmark, MessageSquare, Sparkles } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { GdpVizStudio } from "@/components/viz/GdpVizStudio";
import { AskTheLedger } from "@/components/ledger/AskTheLedger";
import { getInstanceOverview, type InstanceOverview } from "@/lib/ledger.functions";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/ledger")({
  head: ({ params }) => ({
    meta: [
      { title: `National Ledger · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["ledger", "overview", params.code],
        queryFn: () => getInstanceOverview({ data: { countryCode: params.code } }),
      }),
    );
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-red-600">{error.message}</p>
    </div>
  ),
  component: LedgerChamber,
});

function LedgerChamber() {
  const params = Route.useParams();
  const code = params.code;
  const fetchOverview = useServerFn(getInstanceOverview);

  const { data: overview } = useSuspenseQuery(
    queryOptions({
      queryKey: ["ledger", "overview", code],
      queryFn: () => fetchOverview({ data: { countryCode: code } }),
    }),
  );

  return (
    <SuperAdminShell
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Ledger" },
      ]}
    >

      <div className="min-h-dvh bg-paper-0 text-ink-950">
        <CeremonialHeader overview={overview} code={code} />

        <main className="mx-auto max-w-7xl px-6 py-10 md:px-10 space-y-14">
          <StudioSection code={code} />

          <AskSection code={code} name={overview.country.name} />

          <HandoffDock code={code} />
        </main>
      </div>
    </SuperAdminShell>
  );
}

/* ─────────────────────────── Ceremonial Header ─────────────────────────── */

function CeremonialHeader({ overview, code }: { overview: InstanceOverview; code: string }) {
  const { country } = overview;

  return (
    <header className="relative overflow-hidden border-b border-line-200 bg-gradient-to-br from-paper-0 via-paper-0 to-[color-mix(in_oklab,var(--color-gold-500)_6%,transparent)]">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[color-mix(in_oklab,var(--color-gold-500)_10%,transparent)] blur-3xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/countries/$code/onboard"
            params={{ code }}
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500 hover:text-ink-950"
          >
            ← {country.name}
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            <BookOpen size={12} strokeWidth={1.5} />
            Chamber 01 · The National Ledger
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[auto,1fr,auto] md:items-end">
          <Crest code={country.code} />

          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
              {country.code} · {country.currency} · fiscal year starts month {country.fiscalYearStartMonth}
              {country.isCbiState && " · CBI state"}
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-tight md:text-6xl">{country.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-ink-500">
              An evidence-anchored view of what this economy is made of, how confident we are in the numbers,
              and where they are trending. Every figure below can be traced to a source.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <HeadlineStat
              label="GDP"
              value={formatUsd(overview.country.countryPack?.gdp_current_usd as number | undefined)}
              hint={`${overview.country.countryPack?.gdp_year ?? "—"}`}
            />
            <LiveClock />
          </div>
        </div>

        {/* Answer strip — 3 pinnable figures anchored to the header */}
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded border border-line-200 bg-line-200 md:grid-cols-3">
          <AnswerCell
            label="Sectors ledgered"
            value={String(overview.composition.length)}
            hint="Committed shares"
            grade={topGrade(overview.composition.map((c) => c.confidence_grade))}
          />
          <AnswerCell
            label="Exposure index"
            value={overview.exposureIndex ? `${overview.exposureIndex.value.toFixed(1)}` : "—"}
            hint={overview.exposureIndex?.period ?? "not yet ledgered"}
            grade={overview.exposureIndex?.confidence_grade ?? null}
          />
          <AnswerCell
            label="Currency"
            value={country.currency}
            hint={country.isCbiState ? "CBI programme active" : "No CBI"}
            grade="A"
          />
        </div>
      </div>
    </header>
  );
}

function Crest({ code }: { code: string }) {
  return (
    <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-ink-950 bg-paper-0 shadow-sm md:h-28 md:w-28">
      <span className="font-serif text-3xl tracking-tight md:text-4xl">{code.slice(0, 3)}</span>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
      <Clock size={12} strokeWidth={1.5} />
      as of {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </div>
  );
}

function HeadlineStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">{label}</div>
      <div className="font-serif text-4xl tabular-nums md:text-5xl">{value}</div>
      {hint && <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{hint}</div>}
    </div>
  );
}

function AnswerCell({ label, value, hint, grade }: { label: string; value: string; hint?: string; grade: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-paper-0 px-5 py-4">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">{label}</div>
        <div className="mt-1 font-serif text-2xl tabular-nums leading-tight">{value}</div>
        {hint && <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{hint}</div>}
      </div>
      {grade && <GradeChip grade={grade} />}
    </div>
  );
}

function GradeChip({ grade }: { grade: string }) {
  const g = grade.toUpperCase();
  const styles: Record<string, string> = {
    A: "bg-ink-950 text-paper-0 border-ink-950",
    B: "bg-paper-0 text-ink-950 border-ink-950",
    C: "bg-paper-0 text-ink-500 border-line-200",
    D: "bg-paper-0 text-ink-500 border-dashed border-line-200",
  };
  return (
    <span
      title={`Confidence grade ${g}`}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm border font-mono text-[11px] font-semibold ${styles[g] ?? styles.C}`}
    >
      {g}
    </span>
  );
}

function topGrade(grades: string[]): string {
  const rank: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  return grades.reduce((best, g) => (rank[g.toUpperCase()] > (rank[best] ?? 0) ? g.toUpperCase() : best), "D");
}

function formatUsd(v: number | undefined | null): string {
  if (!v || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

/* ─────────────────────────── Studio Section ─────────────────────────── */

function StudioSection({ code }: { code: string }) {
  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="Hero visualization"
        title="Composition, trend, and trust"
        blurb="Sector treemap, macro strip, ministry×sector heatmap, KPI series, and the fiscal horizon — every chart backed by the same evidence rail."
      />
      <Suspense fallback={<Skeleton height={520} />}>
        <GdpVizStudio code={code} />
      </Suspense>
    </section>
  );
}

/* ─────────────────────────── Ask Section ─────────────────────────── */

function AskSection({ code, name }: { code: string; name: string }) {
  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="Ask the Ledger"
        title="Retrieval-only Q&A, grounded in this country's second brain"
        blurb="Every answer cites the source, refuses ungrounded claims, and can be pinned as a figure snapshot."
      />
      <div className="rounded border border-line-200 bg-paper-0 p-4 md:p-6">
        <AskTheLedger countryCode={code} countryName={name} />
      </div>
    </section>
  );
}

/* ─────────────────────────── Handoff Dock ─────────────────────────── */

function HandoffDock({ code }: { code: string }) {
  const handoffs = [
    { to: "/instrument/scenarios" as const, icon: Sparkles, title: "Rehearse in Scenarios", blurb: "Test a policy without consequences" },
    { to: "/narrative" as const, icon: MessageSquare, title: "Draft a statement", blurb: "Turn signal into narrative" },
    { to: "/instrument/cabinet" as const, icon: Landmark, title: "Send to Cabinet", blurb: "Add to Session Mode agenda" },
  ];
  return (
    <section className="space-y-4">
      <SectionHeading eyebrow="Handoff" title="Take the ledger somewhere useful" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {handoffs.map((h) => {
          const Icon = h.icon;
          return (
            <Link
              key={h.to}
              to={h.to}
              className="group relative flex items-center gap-4 border border-line-200 bg-paper-0 p-5 transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center border border-line-200 text-ink-950">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-lg">{h.title}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{h.blurb}</div>
              </div>
              <ArrowUpRight size={16} strokeWidth={1.5} className="text-ink-500 transition group-hover:text-ink-950" />
            </Link>
          );
        })}
        <div className="sm:col-span-3">
          <Link
            to="/admin/countries/$code/data"
            params={{ code }}
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500 hover:text-ink-950"
          >
            Manage the underlying data stores →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section chrome ─────────────────────────── */

function SectionHeading({ eyebrow, title, blurb }: { eyebrow: string; title: string; blurb?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">{eyebrow}</div>
      <h2 className="mt-1 font-serif text-2xl md:text-3xl">{title}</h2>
      {blurb && <p className="mt-2 text-sm text-ink-500">{blurb}</p>}
    </div>
  );
}

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded border border-line-200 bg-[color-mix(in_oklab,var(--color-ink-500)_5%,transparent)]"
      style={{ height }}
      aria-hidden
    />
  );
}
