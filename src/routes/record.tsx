import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { FactRail, GradeMark } from "@/components/brief/FactRail";
import { BriefingForm } from "@/components/marketing/BriefingForm";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { getBriefCountries, getCountryFacts } from "@/lib/calculator/facts.functions";
import type { CountryFacts, FactGrade } from "@/lib/calculator/facts.server";
import { getCorpusStats } from "@/lib/record/corpus-stats.functions";
import {
  BeforeAfter,
  CorpusConstellation,
  CorpusPulse,
  CustodyRings,
  EffortBars,
  FigureJourney,
  GradeRing,
  TrustScale,
} from "@/components/record/RecordVisuals";

const SITE_URL = "https://gdpvision.com";
const TITLE = "The National Record — every figure Cabinet relies on, with its source and grade";
const DESCRIPTION =
  "How GDPVision keeps one national record of public evidence and government data: each figure sourced, dated and graded, restricted records kept apart, and the whole record carried forward from one decision to the next.";

export const Route = createFileRoute("/record")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/record` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/record` }],
  }),
  component: RecordPage,
});

const MICRO = "font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500";
const SECTION = "border-b border-line-200";
const WRAP = "mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-24";

const LIFE = [
  {
    head: "Found",
    body: "Research agents and analysts gather the figure from national, regional and international sources, organised by ministry and sector.",
  },
  {
    head: "Cited",
    body: "It is stored with its source address, the period it describes and the date it was collected. A figure without a source is not admitted.",
  },
  {
    head: "Graded",
    body: "It carries a confidence grade, so a reader can see at once whether it is the country's own record, a published estimate or an assumption.",
  },
  {
    head: "Kept single",
    body: "A second copy of the same fact is recognised and merged, not added. Cabinet sees one figure, not three versions of it.",
  },
  {
    head: "Used",
    body: "Briefings, scenarios, sector plans and the Decision Brief draw on the same figure, and each shows where it came from.",
  },
  {
    head: "Kept current",
    body: "When a source publishes a new period, the record is refreshed and the change is visible. Superseded figures stay in the history.",
  },
];

const RECORDS = [
  {
    head: "Public evidence",
    body: "National statistics, budgets, central bank and regional data, international indexes and published reports. Researched, cited and graded. Suitable for the country's public platform and for investors.",
  },
  {
    head: "Government records",
    body: "Contracts, memoranda, Cabinet papers, ministry returns and briefings uploaded by authorised officials. The same checking standard, visible only to approved users of that country, with every access logged.",
  },
  {
    head: "State-owned data",
    body: "Tax, customs, treasury and registry records that must never leave the country. They stay in the Sovereign Vault on government premises; only findings approved by named officials join the record.",
    link: true,
  },
];

const CHANGES = [
  {
    q: "Where did this number come from?",
    before: "Someone has to find the spreadsheet, and the person who built it.",
    after: "The source, period and grade are one click from the figure.",
  },
  {
    q: "How long does a Cabinet question take to answer?",
    before: "Weeks, while ministries assemble and reconcile their own versions.",
    after: "The evidence is already assembled, so the question starts from what is known.",
  },
  {
    q: "What survives a change of minister or government?",
    before: "Knowledge leaves with the people who held it.",
    after: "The record, its sources and the decisions taken on it remain with the state.",
  },
  {
    q: "What can investors and lenders be shown?",
    before: "Figures assembled for each request, often inconsistent between requests.",
    after: "One public, cited set of figures, and approved aggregates from restricted data.",
  },
  {
    q: "How is the country prepared for the global indexes?",
    before: "Submissions are compiled under deadline from whatever is to hand.",
    after: "The measures the indexes read are already tracked, with their evidence.",
  },
];

const GRADES: Array<{ grade: FactGrade; body: string }> = [
  {
    grade: "A",
    body: "The country's own committed record, or an official statistic from the national authority or an international body.",
  },
  { grade: "B", body: "A credible published source that the record has not yet confirmed." },
  { grade: "C", body: "An estimate or an inference, marked so it is never mistaken for fact." },
  {
    grade: "assumption",
    body: "No national figure is held; a regional figure stands in until the country's own replaces it.",
  },
];

function LiveRecord({
  code,
  setCode,
  facts,
}: {
  code: string;
  setCode: (c: string) => void;
  facts: { data: CountryFacts | null | undefined; isLoading: boolean; isError: boolean };
}) {
  const fetchCountries = useServerFn(getBriefCountries);
  const countries = useQuery({ queryKey: ["brief-countries"], queryFn: () => fetchCountries() });
  const [active, setActive] = useState<FactGrade | null>(null);

  return (
    <div>
      <label className="block max-w-sm">
        <span className={MICRO}>Country</span>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-2 w-full border border-line-200 bg-paper-0 px-4 py-3 text-[15px] text-ink-950 focus:border-ink-950 focus:outline-none"
        >
          {(countries.data ?? [{ code: "ATG", name: "Antigua and Barbuda", onboarded: true }]).map(
            (c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.onboarded ? "" : " — reference figures"}
              </option>
            ),
          )}
        </select>
      </label>
      <div className="mt-10 border border-line-200 bg-paper-50 p-6 sm:p-8">
        <GradeRing facts={facts.data ?? null} active={active} onActive={setActive} />
      </div>
      <div className="mt-8">
        {facts.isError || (!facts.isLoading && !facts.data) ? (
          <p className="border-l-2 border-line-200 py-2 pl-4 text-[14px] text-ink-500">
            The live record could not be loaded just now. Choose the country again, or request a
            briefing to walk through it with us.
          </p>
        ) : (
          <FactRail facts={facts.data ?? null} loading={facts.isLoading} />
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/business-case/brief"
          search={{ country: code }}
          className="btn-secondary px-5 py-2.5 text-xs"
        >
          See what these figures are worth in the Decision Brief
        </Link>
      </div>
    </div>
  );
}

function RecordPage() {
  const fetchFacts = useServerFn(getCountryFacts);
  const fetchStats = useServerFn(getCorpusStats);
  const [code, setCode] = useState("ATG");
  const facts = useQuery({
    queryKey: ["brief-facts", code],
    queryFn: () => fetchFacts({ data: { code } }),
    staleTime: 60 * 60 * 1000,
  });
  const stats = useQuery({
    queryKey: ["corpus-stats", code],
    queryFn: () => fetchStats({ data: { code } }),
    staleTime: 10 * 60 * 1000,
  });
  const [ring, setRing] = useState<number | null>(null);
  const gdp = facts.data?.facts.find((f) => /gdp/i.test(f.key))?.display;
  const figure = gdp ? `${facts.data?.name ?? ""} GDP ${gdp}` : "GDP";
  return (
    <MarketingShell>
      {/* HERO */}
      <section className={SECTION}>
        <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-6 sm:py-16 md:px-10 md:py-20">
          <Link
            to="/"
            hash="corpus"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> One trusted national record
          </Link>
          <div className="mt-8 grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
            <div className="max-w-4xl">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Instrument · The National Record
              </div>
              <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
              <h1 className="mt-5 font-serif text-[30px] leading-[1.08] tracking-tight text-ink-950 sm:text-[40px] sm:leading-[1.05] md:text-[52px]">
                Every figure Cabinet relies on, with its source, its date and its grade.
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
                An economy cannot be managed faster than its evidence can be found and trusted.
                GDPVision keeps one national record: public evidence and government data, each
                figure sourced and graded, restricted records kept apart, and the whole record
                carried forward from one decision to the next.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#live" className="btn-primary px-5 py-2.5 text-xs">
                  See a live record
                </a>
                <a href="#record-briefing" className="btn-ghost px-5 py-2.5 text-xs">
                  Request a briefing
                </a>
              </div>
            </div>
            <CorpusConstellation stats={stats.data ?? null} scopeLabel={facts.data?.name ?? code} />
          </div>
        </div>
      </section>

      {/* LIVE */}
      <section id="live" className={SECTION}>
        <div className={WRAP}>
          <SectionHeader
            eyebrow="The record, live"
            title="This is what GDPVision already holds for a country."
            lede="Public figures only, drawn from the record as it stands today. Each carries its source and a confidence grade; where the record is silent, the figure is marked as an assumption rather than presented as fact."
          />
          <div className="mt-12">
            <LiveRecord code={code} setCode={setCode} facts={facts} />
          </div>
        </div>
      </section>

      {/* LIFE OF A FIGURE */}
      <section className={SECTION}>
        <div className={WRAP}>
          <SectionHeader
            eyebrow="The life of a figure"
            title="Six steps between a published number and a Cabinet decision."
          />
          <div className="mt-12">
            <FigureJourney steps={LIFE} figure={figure} />
          </div>
        </div>
      </section>

      {/* THREE RECORDS */}
      <section className={SECTION}>
        <div className={WRAP}>
          <SectionHeader
            eyebrow="Public and state-owned, kept apart"
            title="Three kinds of evidence. One view for a decision. No confusion between them."
            lede="Visibility is recorded on every item. A briefing can draw on all three, and always shows which is which."
          />
          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[340px_1fr]">
            <CustodyRings active={ring} onActive={setRing} />
            <div className="grid gap-8 md:grid-cols-3">
              {RECORDS.map((r, i) => (
                <div
                  key={r.head}
                  onMouseEnter={() => setRing(i)}
                  onMouseLeave={() => setRing(null)}
                  className={`border-t pt-6 transition-colors ${ring === i ? "border-gold-500" : "border-line-200"}`}
                >
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                    {r.head}
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{r.body}</p>
                  {r.link ? (
                    <Link
                      to="/vault"
                      className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                    >
                      The Sovereign Vault →
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT CHANGES */}
      <section className={SECTION}>
        <div className={WRAP}>
          <SectionHeader
            eyebrow="What changes for a government"
            title="The record does not decide. It makes every decision faster to take and easier to defend."
          />
          <div className="mt-12 border-t border-line-200">
            <div className="hidden grid-cols-[1.1fr_1fr_1fr] gap-8 border-b border-line-200 py-3 md:grid">
              <span className={MICRO}>The question</span>
              <span className={MICRO}>Without a record</span>
              <span className={MICRO}>With the record</span>
            </div>
            {CHANGES.map((c, ci) => (
              <BeforeAfter key={c.q} index={ci}>
                {(seen, delay) => (
                  <div className="grid gap-2 border-b border-line-200 py-5 md:grid-cols-[1.1fr_1fr_1fr] md:gap-8">
                    <p className="font-serif text-[18px] leading-snug text-ink-950">{c.q}</p>
                    <p className="text-[15px] leading-relaxed text-ink-500">
                      <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] md:hidden">
                        Without:
                      </span>
                      {c.before}
                    </p>
                    <p className="border-l-2 border-gold-500 pl-4 text-[15px] leading-relaxed text-ink-950">
                      <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 md:hidden">
                        With:
                      </span>
                      {c.after}
                    </p>
                    <div className="md:col-start-2 md:col-span-2">
                      <EffortBars seen={seen} delay={delay} />
                    </div>
                  </div>
                )}
              </BeforeAfter>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-ink-500">
            Bars are illustrative of relative effort, not measurements. It is also the foundation
            the rest of GDPVision stands on: the chambers, the Decision Brief and the global
            measures on the home page all read from the same record.
          </p>
        </div>
      </section>

      {/* GRADES */}
      <section className={SECTION}>
        <div className={WRAP}>
          <SectionHeader
            eyebrow="Confidence grades"
            title="A reader can see how far to trust a figure before relying on it."
          />
          <div className="mt-12 max-w-3xl">
            <TrustScale facts={facts.data ?? null} />
          </div>
          <dl className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {GRADES.map((g) => (
              <div key={g.grade} className="border-t border-line-200 pt-5">
                <dt>
                  <GradeMark grade={g.grade} />
                </dt>
                <dd className="mt-3 text-[15px] leading-relaxed text-ink-700">{g.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CorpusPulse stats={stats.data ?? null} />

      {/* BRIEFING */}
      <section id="record-briefing" className={SECTION}>
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <SectionHeader
            eyebrow="Request a briefing"
            title="See your country's record, and what it is missing."
            lede="A principal from OPEN Interactive will walk your team through the record GDPVision already holds for your country and the evidence that would raise its grades."
          />
          <BriefingForm topic="record" />
        </div>
      </section>
      <FloatingBackToTop />
    </MarketingShell>
  );
}
