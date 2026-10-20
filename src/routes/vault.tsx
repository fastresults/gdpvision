import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BriefingForm } from "@/components/marketing/BriefingForm";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { SovereignDecisionCircuit } from "@/components/marketing/SovereignDecisionCircuit";
import { Illustration } from "@/components/marketing/Illustration";
import foundationArt from "@/assets/illustrations/vault-foundation.jpg.asset.json";
import boundaryArt from "@/assets/illustrations/vault-boundary.jpg.asset.json";
import progressArt from "@/assets/illustrations/vault-progress.jpg.asset.json";
import custodyArt from "@/assets/illustrations/vault-custody.jpg.asset.json";
import workbenchArt from "@/assets/illustrations/vault-workbench.jpg.asset.json";
import briefingArt from "@/assets/illustrations/vault-briefing.jpg.asset.json";

const SITE_URL = "https://gdpvision.com";
const TITLE =
  "The Sovereign Vault — stronger national decisions, government in control | GDPVision";
const DESCRIPTION =
  "Put national data to work for better policy, investment and lasting economic progress. The Sovereign Vault brings data together on government premises, with private records protected and findings approved by officials.";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/vault` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/vault` }],
  }),
  component: VaultPage,
});

const MICRO = "font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500";

const RULES = [
  {
    head: "Private records stay inside",
    body: "Sensitive records are analysed on government premises, not copied to GDPVision’s cloud or an outside AI service. Government retains custody of the information behind each finding.",
  },
  {
    head: "Public data comes in",
    body: "Published statistics, regional comparisons and the national data library come to the Vault. Officials can connect that wider picture to the country’s own records without exposing them.",
  },
  {
    head: "Only approved findings go out",
    body: "A combined finding—not a person’s or organisation’s private record—must pass privacy checks and receive approval from the data custodian and a second official. Its source remains clear when it joins GDPVision’s national data.",
  },
];

const SECURITY = [
  "Government-held keys protect encrypted storage. Custody stays with the state, not OPEN Interactive.",
  "The reference design accepts no inbound connections. It retrieves authorised work through a verified, encrypted channel and supports disconnected operation.",
  "A tamper-resistant audit record tracks each analysis, approval and release, so responsibility can be inspected.",
  "The data custodian and a second official must approve findings before release.",
  "Private-data analysis runs locally. Private text is not sent to an outside AI service.",
  "Security testing, handover checks and ongoing review are defined in the country’s agreed deployment specification.",
];

const SERVICE = [
  {
    head: "Know the data",
    body: "See which datasets are available, who owns them and when they were updated—without viewing the private records.",
  },
  {
    head: "Ask the question",
    body: "Submit an approved question about policy, spending or delivery. The Vault analyses the data on government premises.",
  },
  {
    head: "Review and approve",
    body: "Follow progress, check the finding and its privacy review, then obtain the two required approvals before release.",
  },
  {
    head: "Put findings to work",
    body: "Read approved findings alongside public data, with their origin clear, to inform decisions and track delivery.",
  },
];

function VaultPage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-6 sm:py-16 md:px-10 md:py-20">
          <Link
            to="/"
            hash="sovereignty"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Sovereignty
          </Link>
          <div className="mt-8 grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-14">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Government-held data · National advantage
              </div>
              <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
              <h1 className="mt-5 max-w-3xl font-serif text-[30px] leading-[1.08] text-ink-950 sm:text-[40px] sm:leading-[1.05] md:text-[50px]">
                The Sovereign Vault
              </h1>
              <p className="mt-4 max-w-xl font-serif text-[24px] leading-tight text-ink-950 sm:text-[28px]">
                Put your country’s data to work. Keep government in control.
              </p>
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
                Bring sensitive national records and public data together on government
                premises. Give Cabinet and ministries a stronger basis for policy, investment and
                delivery—so your country can act sooner, strengthen its regional position and build
                economic progress that lasts. Private records stay protected; officials approve what
                may be shared.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#vault-briefing" className="btn-primary px-5 py-2.5 text-xs">
                  Request a briefing on the Vault
                </a>
                <Link to="/business-case/brief" className="btn-ghost px-5 py-2.5 text-xs">
                  See the Decision Brief
                </Link>
              </div>
            </div>
            <div className="flex min-w-0 justify-center md:justify-end">
              <SovereignDecisionCircuit />
            </div>
          </div>
        </div>
      </section>

      {/* WHAT ARRIVES */}
      <section className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="The national foundation"
              title="A secure foundation for better national decisions."
            />
            <Illustration src={foundationArt.url} variant="aside" className="mt-8" />
          </div>
          <div className="space-y-5 border-t border-line-200 pt-8 text-[16px] leading-relaxed text-ink-700 md:border-t-0 md:pt-0">
            <p>
              Tax, customs, treasury, registry, health and employment records can reveal what public
              statistics alone cannot. The Vault gives government a secure place to analyse these
              records together—turning information held across ministries into data leaders can
              use.
            </p>
            <p>
              Computing, storage and local AI operate on government premises. Installation,
              encrypted storage, backup power and recovery arrangements are confirmed in each
              country’s deployment specification. The purpose is simple: make valuable information
              useful without surrendering control of it.
            </p>
          </div>
        </div>
      </section>

      {/* THREE RULES */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-24">
          <SectionHeader
            eyebrow="Three clear boundaries"
            title="Use more data. Share only what government approves."
          />
          <Illustration src={boundaryArt.url} variant="rule" className="mx-auto mt-8" />
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {RULES.map((r, i) => (
              <div key={r.head} className="border-t-2 border-gold-500 pt-5">
                <div className={MICRO}>{String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-3 font-serif text-[22px] leading-snug text-ink-950">{r.head}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY IT MOVES GDP */}
      <section className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="The economic advantage"
              title="Act sooner. Invest more wisely. Build progress that lasts."
            />
            <div className="mt-6 space-y-5 text-[16px] leading-relaxed text-ink-700">
              <p>
                Where is public spending delivering results? What is delaying an investment? Which
                sectors need ministries to act together? The answers often sit in national records
                that are difficult to bring together when a decision is needed.
              </p>
              <p>
                A stronger data base helps government target resources, prepare credible
                investment proposals and address delivery problems earlier. That can strengthen the
                country’s position in a competitive region—and support a faster, more durable path
                to growth. Results still depend on the decisions made and how well they are
                delivered.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Illustration src={progressArt.url} variant="aside" />
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="Security you can inspect"
              title="Protect national trust—and the freedom to act."
              lede="Government should not have to choose between useful data and control of sensitive records. The Vault’s safeguards keep custody and release decisions in official hands. No system is beyond attack; each deployment needs testing and ongoing oversight."
            />
            <Illustration src={custodyArt.url} variant="aside" className="mt-8" />
          </div>
          <ul className="divide-y divide-line-200 border-y border-line-200">
            {SECURITY.map((s) => (
              <li key={s} className="py-4 text-[15px] leading-relaxed text-ink-700">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* MANAGED FROM GDPVISION */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-24">
          <div className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
            <SectionHeader
              eyebrow="Managed from GDPVision"
              title="One clear process—from question to approved finding."
              lede="Officials can see what data is available, request analysis and follow the approval process. GDPVision receives dataset descriptions, requests and approved findings—not the private records behind them. Government decides what may be released."
            />
            <div className="flex justify-end">
              <Illustration src={workbenchArt.url} variant="aside" />
            </div>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE.map((s, i) => (
              <div key={s.head} className="border-t border-line-200 pt-5">
                <div className={MICRO}>0{i + 1}</div>
                <h3 className="mt-3 font-serif text-[22px] leading-snug text-ink-950">{s.head}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRIEFING */}
      <section id="vault-briefing" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="Request a briefing"
              title="Start with the decision your government needs to make."
              lede="Tell us the priority, which ministry holds the data and what Cabinet needs to decide. We’ll discuss where the Vault could help and what a government-controlled deployment would require. A principal from OPEN Interactive will respond through your official email."
            />
            <Illustration src={briefingArt.url} variant="spot" className="mt-8" />
          </div>
          <BriefingForm topic="vault" />
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-6 md:px-10">
        <p className="max-w-3xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink-500">
          The Vault reference build uses NVIDIA DGX Spark systems. Specifications vary by deployment
          and are confirmed in each country’s agreed project specification.
        </p>
      </div>
      <FloatingBackToTop />
    </MarketingShell>
  );
}
