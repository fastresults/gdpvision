import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Illustration } from "@/components/marketing/Illustration";
import { NumberTile } from "@/components/marketing/NumberTile";
import { CHAMBERS } from "@/lib/chambers";
import {
  APPROVALS,
  APPROVALS_CLOSE,
  BUSINESS_CASE_META,
  CANNOTS,
  CHAMBER_LINES,
  CHEAP_ANSWER_INTRO,
  CORPUS_FOOTNOTE,
  EXECUTIVE_SUMMARY,
  INSTRUMENTATION_INTRO,
  INSTRUMENT_INTRO,
  NOT_CLAIMED,
  OPTIONS_CLOSE,
  OPTION_PATHS,
  PROVENANCE_PARAS,
  RECOMMENDATION,
  RISKS_NOT_PROCEEDING,
  RISKS_PROCEEDING,
  SEVEN_QUESTIONS,
  SHADOW_AI_INTRO,
  SHADOW_CLOSE,
  SHADOW_LIABILITIES,
  SOURCES,
  SOURCES_NOTE,
  STAGES,
  STAKES,
  STAKES_CLOSE,
  THREE_FAILURES,
  TIER_ONE_CLOSE,
  TIER_ONE_INTRO,
  TIER_ONE_TESTS,
  WORTH,
  WORTH_INTRO,
} from "@/lib/business-case";
import artInstrument from "@/assets/illustrations/bc-instrument.jpg.asset.json";
import artCliff from "@/assets/illustrations/bc-cliff.jpg.asset.json";
import artLag from "@/assets/illustrations/bc-lag.jpg.asset.json";
import artComponent from "@/assets/illustrations/bc-component.jpg.asset.json";
import artLedgerCost from "@/assets/illustrations/bc-ledger-cost.jpg.asset.json";
import artPaths from "@/assets/illustrations/bc-paths.jpg.asset.json";
import artSeal from "@/assets/illustrations/bc-seal.jpg.asset.json";
import artBriefingRoom from "@/assets/illustrations/bc-briefing-room.jpg.asset.json";
import ogImage from "@/assets/gdpvision-og.jpg";

const SITE_URL = "https://gdpvision.com";
const TITLE = "The business case for GDPVision — a decision paper";
const DESCRIPTION =
  "Why sovereign economic decision-making should be instrumented as a governed system of record: the stakes, the tier-one test, an options appraisal, the five approvals, and the recommended path.";

export const Route = createFileRoute("/business-case")({
  head: () => {
    const absoluteOg = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:type", content: "article" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: `${SITE_URL}/business-case` },
        { property: "og:image", content: absoluteOg },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: absoluteOg },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/business-case` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: BUSINESS_CASE_META.title,
            description: DESCRIPTION,
            author: { "@type": "Person", name: BUSINESS_CASE_META.author },
            publisher: { "@type": "Organization", name: BUSINESS_CASE_META.org },
            mainEntityOfPage: `${SITE_URL}/business-case`,
            image: absoluteOg,
          }),
        },
      ],
    };
  },
  component: BusinessCasePage,
});

function Section({
  children,
  bordered = true,
}: {
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <section className={bordered ? "border-b border-line-200" : undefined}>
      <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-6 sm:py-16 md:px-10 md:py-24">
        {children}
      </div>

    </section>
  );
}

function Labelled({ label, body }: { label: string; body: string }) {
  return (
    <p className="text-[16.5px] leading-relaxed text-ink-700">
      <span className="font-medium text-ink-950">{label}. </span>
      {body}
    </p>
  );
}

function BusinessCasePage() {
  return (
    <MarketingShell>
      {/* Masthead */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-28">
          <div className="grid gap-10 md:grid-cols-[1fr_320px] md:items-center">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                {BUSINESS_CASE_META.eyebrow}
              </div>
              <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
              <h1 className="mt-5 max-w-3xl font-serif text-[30px] leading-[1.08] tracking-tight text-ink-950 sm:mt-6 sm:text-[40px] sm:leading-[1.05] md:text-[56px]">
                {BUSINESS_CASE_META.title}
              </h1>

              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
                {BUSINESS_CASE_META.standfirst}
              </p>
              <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                {BUSINESS_CASE_META.author} · {BUSINESS_CASE_META.org}
              </div>
            </div>
            <div className="hidden justify-self-end md:block">
              <Illustration src={artInstrument.url} variant="spot" />
            </div>
          </div>
        </div>
      </section>

      {/* Executive summary */}
      <Section>
        <SectionHeader eyebrow="Executive summary" title="The decision in one page." />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            {EXECUTIVE_SUMMARY.slice(0, 3).map((p) => (
              <Labelled key={p.label} {...p} />
            ))}
          </div>
          <div className="space-y-6">
            {EXECUTIVE_SUMMARY.slice(3).map((p) => (
              <Labelled key={p.label} {...p} />
            ))}
            <div className="border-l-2 border-gold-500 pl-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                What is not claimed
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{NOT_CLAIMED}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 1 · What is at stake */}
      <Section>
        <SectionHeader
          eyebrow="01 · What is at stake"
          title="Six figures, each carrying its source and its grade."
          lede="That is a habit rather than a flourish: the argument of this paper is that provenance survives scrutiny, and a document making that argument should meet the standard it sets."
        />
        <div className="mt-14 grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {STAKES.map((s) => (
            <div key={s.label}>
              <NumberTile
                value={s.value}
                unit={s.unit}
                label={s.label}
                grade={s.grade}
                citation={s.citation}
              />
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink-700">{s.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 grid gap-10 md:grid-cols-[300px_1fr] md:items-center">
          <div className="flex justify-center md:block">

            <Illustration src={artCliff.url} variant="spot" />
          </div>
          <p className="max-w-3xl text-[17px] leading-relaxed text-ink-950">{STAKES_CLOSE}</p>
        </div>
      </Section>

      {/* 2 · Instrumentation, not effort */}
      <Section>
        <div className="grid gap-12 md:grid-cols-[1fr_300px] md:items-center">
          <div>
            <SectionHeader
              eyebrow="02 · The problem"
              title="It is instrumentation, not effort."
            />
            <div className="mt-8 space-y-5 max-w-2xl">
              {INSTRUMENTATION_INTRO.map((p) => (
                <p key={p.slice(0, 24)} className="text-[16.5px] leading-relaxed text-ink-700">
                  {p}
                </p>
              ))}
            </div>
            <div className="mt-10 space-y-6 max-w-2xl">
              {THREE_FAILURES.map((f) => (
                <Labelled key={f.label} {...f} />
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-[16.5px] leading-relaxed text-ink-950">
              None of this is a failure of will. It is a failure of instrumentation, and unlike the
              external deadline it is entirely within the region's power to fix.
            </p>
          </div>
          <div className="hidden justify-self-end md:block">
            <Illustration src={artLag.url} variant="spot" />
          </div>
        </div>
      </Section>

      {/* 3 · The cheap answer */}
      <Section>
        <SectionHeader
          eyebrow="03 · The obvious cheap answer, taken seriously"
          title="A language model is a component. It is not a system."
        />
        <div className="mt-8 max-w-2xl space-y-5">
          {CHEAP_ANSWER_INTRO.map((p) => (
            <p key={p.slice(0, 24)} className="text-[16.5px] leading-relaxed text-ink-700">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10">
          <Illustration src={artComponent.url} variant="rule" className="mx-auto" />
        </div>
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
          What a chat session cannot do — not “does less well”, but cannot, by construction
        </p>
        <ol className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {CANNOTS.map((c, i) => (
            <li key={c.label} className="border-t border-line-200 pt-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-2 font-serif text-[21px] leading-tight text-ink-950">
                {c.label}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{c.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 4 · Shadow AI */}
      <Section>
        <SectionHeader
          eyebrow="04 · The alternative is not free"
          title="Because it is already running."
        />
        <div className="mt-8 max-w-2xl space-y-5">
          {SHADOW_AI_INTRO.map((p) => (
            <p key={p.slice(0, 24)} className="text-[16.5px] leading-relaxed text-ink-700">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {SHADOW_LIABILITIES.map((l) => (
            <div key={l.label} className="border-t border-line-200 pt-5">
              <div className="font-serif text-[21px] leading-tight text-ink-950">{l.label}</div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{l.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-[300px_1fr] md:items-center">
          <div className="flex justify-center md:block">
            <Illustration src={artLedgerCost.url} variant="spot" />
          </div>
          <p className="max-w-3xl text-[17px] leading-relaxed text-ink-950">{SHADOW_CLOSE}</p>
        </div>
      </Section>

      {/* 5 · Tier one */}
      <Section>
        <SectionHeader
          eyebrow="05 · The decision"
          title="What class of system is this?"
          lede={TIER_ONE_INTRO[0]}
        />
        <p className="mt-6 max-w-2xl text-[16.5px] leading-relaxed text-ink-700">
          {TIER_ONE_INTRO[1]}
        </p>

        {/* Mobile: stacked definition list */}
        <div className="mt-10 border-t border-line-200 md:hidden">
          {TIER_ONE_TESTS.map((r) => (
            <div key={r.test} className="border-b border-line-200 py-5">
              <div className="text-[15.5px] leading-relaxed text-ink-950">{r.test}</div>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    Chat subscription
                  </dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-ink-500">{r.chat}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-500">
                    GDPVision
                  </dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-ink-700">{r.instrument}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: comparison table */}
        <div className="mt-12 hidden overflow-hidden border border-line-200 md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Tier-one tests: a chat subscription compared with GDPVision
            </caption>
            <thead>
              <tr className="border-b border-line-200 bg-paper-50">
                <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500">
                  Test
                </th>
                <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500">
                  Chat subscription
                </th>
                <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500">
                  GDPVision
                </th>
              </tr>
            </thead>
            <tbody>
              {TIER_ONE_TESTS.map((r) => (
                <tr key={r.test} className="border-b border-line-100 last:border-b-0 align-top">
                  <td className="px-4 py-4 text-[15px] leading-relaxed text-ink-950">{r.test}</td>
                  <td className="px-4 py-4 text-[15px] text-ink-500">{r.chat}</td>
                  <td className="px-4 py-4 text-[15px] text-ink-700">{r.instrument}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-10 max-w-3xl text-[17px] leading-relaxed text-ink-950">{TIER_ONE_CLOSE}</p>
      </Section>

      {/* 6 · Options appraisal */}
      <Section>
        <SectionHeader
          eyebrow="06 · Options appraisal"
          title="Three paths, and what the government owns after three years."
        />
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {OPTION_PATHS.map((p) => (
            <article key={p.key} className="border-t-2 border-ink-950 pt-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                Path {p.key}
              </div>
              <h3 className="mt-2 font-serif text-[24px] leading-tight text-ink-950">{p.title}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.owns.map((o) => (
                  <span
                    key={o}
                    className="border border-line-200 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-700"
                  >
                    {o}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-700">{p.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-[1fr_300px] md:items-center">
          <p className="max-w-3xl text-[17px] leading-relaxed text-ink-950">{OPTIONS_CLOSE}</p>
          <div className="hidden justify-self-end md:block">
            <Illustration src={artPaths.url} variant="spot" />
          </div>
        </div>
      </Section>

      {/* 7 · What the instrument is */}
      <Section>
        <SectionHeader
          eyebrow="07 · What the instrument actually is"
          title={INSTRUMENT_INTRO}
        />
        <div className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {CHAMBERS.map((c) => (
            <div key={c.index} className="relative border-t border-line-200 pt-5 pl-5">
              <div
                aria-hidden
                className="absolute left-0 top-0 h-full w-[2px]"
                style={{ background: `var(${c.accentVar})` }}
              />
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
                Chamber {c.index}
              </div>
              <h3 className="mt-2 font-serif text-[22px] leading-tight text-ink-950">{c.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
                {CHAMBER_LINES[c.index] ?? c.purpose}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-2xl text-[17px] leading-relaxed text-ink-950">{CORPUS_FOOTNOTE}</p>
      </Section>

      {/* 8 · What this is worth */}
      <Section>
        <SectionHeader
          eyebrow="08 · What this is worth to a sovereign economy"
          title="Mechanisms, not measured results."
          lede={WORTH_INTRO}
        />
        <div className="mt-10 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {WORTH.map((w) => (
            <Labelled key={w.label} {...w} />
          ))}
        </div>
      </Section>

      {/* 9 · Five approvals */}
      <Section>
        <div className="grid gap-12 md:grid-cols-[300px_1fr] md:items-start">
          <div className="flex justify-center md:block md:pt-2">
            <Illustration src={artSeal.url} variant="spot" />
          </div>
          <div>
            <SectionHeader
              eyebrow="09 · The five approvals"
              title="Sovereign procurement has no single buyer."
              lede="Five people must each be satisfied, by different things."
            />
            <div className="mt-10 space-y-6 max-w-2xl">
              {APPROVALS.map((a) => (
                <Labelled key={a.label} {...a} />
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-[16.5px] leading-relaxed text-ink-950">
              {APPROVALS_CLOSE}
            </p>
          </div>
        </div>
      </Section>

      {/* 10 · Who built it */}
      <Section>
        <SectionHeader
          eyebrow="10 · Who built it, and why that matters"
          title="The hard parts are not the screens."
        />
        <div className="mt-8 max-w-2xl space-y-5">
          {PROVENANCE_PARAS.map((p) => (
            <p key={p.slice(0, 24)} className="text-[16.5px] leading-relaxed text-ink-700">
              {p}
            </p>
          ))}
        </div>
      </Section>

      {/* 11 · Risks */}
      <Section>
        <SectionHeader eyebrow="11 · Risks, in both directions" title="Stated plainly." />
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div className="border-t-2 border-ink-950 pt-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
              Risks of proceeding
            </div>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-700">{RISKS_PROCEEDING}</p>
          </div>
          <div className="border-t-2 border-ink-950 pt-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
              Risks of not proceeding
            </div>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-700">{RISKS_NOT_PROCEEDING}</p>
          </div>
        </div>
      </Section>

      {/* 12 · Recommended path */}
      <Section>
        <SectionHeader eyebrow="12 · Recommended path" title="Briefing, pilot, deployment." />
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STAGES.map((s, i) => (
            <li key={s.label} className="border-t-2 border-ink-950 pt-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-2 font-serif text-[22px] leading-tight text-ink-950">{s.label}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 13 · The test */}
      <Section>
        <SectionHeader
          eyebrow="13 · The test to run before deciding"
          title="Put these to any AI tool a government is considering — including ours."
        />
        <ol className="mt-10 max-w-3xl divide-y divide-line-200 border-y border-line-200">
          {SEVEN_QUESTIONS.map((q, i) => (
            <li key={q} className="flex gap-5 py-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 pt-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-serif text-[20px] leading-snug text-ink-950">{q}</span>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-3xl text-[17px] leading-relaxed text-ink-950">
          <span className="font-medium">Recommendation. </span>
          {RECOMMENDATION}
        </p>
      </Section>

      {/* Sources */}
      <Section>
        <SectionHeader
          eyebrow="Sources and confidence grades"
          title="Every figure, with the grade we assign it."
          lede={SOURCES_NOTE}
        />
        <ul className="mt-10 max-w-3xl divide-y divide-line-200 border-y border-line-200">
          {SOURCES.map((s) => (
            <li key={s.figure} className="py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center border border-line-200 px-1.5 text-[10px] font-medium text-ink-700">
                  {s.grade}
                </span>
                <div>
                  <div className="text-[15.5px] leading-relaxed text-ink-950">{s.figure}</div>
                  <div className="mt-1 font-mono text-[11px] leading-relaxed text-ink-500">
                    {s.source}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Close */}
      <section>
        <div className="mx-auto max-w-[1280px] px-6 py-20 md:px-10 md:py-28">
          <div className="grid gap-10 md:grid-cols-[1fr_320px] md:items-center">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Cabinet briefing
              </div>
              <h2 className="mt-5 font-serif text-[34px] leading-[1.1] tracking-tight text-ink-950 md:text-[43px]">
                Request a confidential briefing.
              </h2>
              <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-700">
                A short, dignified enquiry from a member of a sitting government or their designated
                advisor. OPEN Interactive responds within one working day.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="/#briefing"
                  className="btn-primary inline-flex px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em]"
                >
                  Request a Cabinet briefing
                </a>
                <Link
                  to="/op-eds"
                  className="btn-secondary inline-flex px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em]"
                >
                  Read the writing
                </Link>
              </div>
            </div>
            <div className="hidden justify-self-end md:block">
              <Illustration src={artBriefingRoom.url} variant="spot" />
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
