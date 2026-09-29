import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import vaultArt from "@/assets/vault/vault-reference-build.jpg";
import { BriefingForm } from "@/components/marketing/BriefingForm";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const SITE_URL = "https://gdpvision.com";
const TITLE =
  "The Sovereign Vault — the data a nation must never share, working for it | GDPVision";
const DESCRIPTION =
  "Every GDPVision deployment includes government-held hardware installed in-country. Private records stay inside it; public evidence comes to them; only findings approved by named officials may leave.";

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
    head: "Private rows never leave",
    body: "No row of Vault data is copied to GDPVision's cloud, to a model provider or to anyone else. The cloud has no table that could hold one.",
  },
  {
    head: "Public evidence comes in",
    body: "The national evidence record, regional figures and published statistics flow into the Vault. Public and private information can then be analysed together where the private data already lives.",
  },
  {
    head: "Only approved findings go out",
    body: "Only a combined result—not a person’s or organisation’s private record—may leave. It must pass disclosure checks and be approved by the data custodian and a second official, with its source marked. It then strengthens the country’s figures in GDPVision.",
  },
];

const SECURITY = [
  "Encrypted storage, with keys held by the government, not by OPEN Interactive.",
  "No outside system can connect into the Vault. It reaches out for authorised work through an encrypted channel that verifies both ends, and it can run fully disconnected.",
  "Every job, approval and export is logged, and the log cannot be edited.",
  "Two-person approval for anything that leaves, matching GDPVision's governance.",
  "Its AI models run on the premises. No private text is ever sent to an outside AI service.",
  "Tested against recognised security frameworks before handover, and on a schedule after it.",
];

const SERVICE = [
  {
    head: "Data register",
    body: "Every dataset is listed with its owner, security level, and last update—without exposing the records inside it.",
  },
  {
    head: "Analysis requests",
    body: "An official asks a question. The Vault receives the approved request and answers it on government premises.",
  },
  {
    head: "Approval queue",
    body: "A result that passes the privacy check still waits for two approvals before it leaves.",
  },
  {
    head: "Released figures",
    body: "Approved combined figures join the national evidence record, clearly marked as results derived from private data.",
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
                Government-controlled system · The Sovereign Vault
              </div>
              <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
              <h1 className="mt-5 max-w-3xl font-serif text-[30px] leading-[1.08] tracking-tight text-ink-950 sm:text-[40px] sm:leading-[1.05] md:text-[50px]">
                The data a nation must never share, working for the decisions it must take.
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
                Every GDPVision deployment includes a Vault: secure hardware installed in-country
                and held by the government. Tax, customs, treasury, registry, health, crime and
                employment records stay inside it. Public evidence comes to them. Only findings that
                a named official approves ever leave.
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
            <figure className="min-w-0">
              <img
                src={vaultArt}
                alt="Three sovereign compute units stacked, the reference build of the GDPVision Vault."
                width={1100}
                height={937}
                loading="eager"
                className="h-auto w-full border border-line-200"
              />
              <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                The standard configuration · three units, installed on government premises
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* WHAT ARRIVES */}
      <section className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <SectionHeader
            eyebrow="What arrives"
            title="A compact group of secure computers, held by the government, that answers on the premises."
          />
          <div className="space-y-5 border-t border-line-200 pt-8 text-[16px] leading-relaxed text-ink-700 md:border-t-0 md:pt-0">
            <p>
              The Vault combines computing and storage in one secure system. It is configured before
              delivery and installed on government premises by the St. Kitts team or a named local
              partner. It holds the private record: the figures too sensitive for any cloud and too
              valuable to leave in spreadsheets.
            </p>
            <p>
              It runs its own AI models on the premises, so a question about private data is
              answered without the data going anywhere. Production sites add an encrypted storage
              system, a firewall, backup power, and an offline copy at a second government site.
            </p>
          </div>
        </div>
      </section>

      {/* THREE RULES */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-24">
          <SectionHeader
            eyebrow="Three rules, built into the machine"
            title="Private stays in. Public comes in. Only what is approved goes out."
          />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
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
          <SectionHeader
            eyebrow="Why it moves GDP"
            title="The most decisive figures are the ones a government cannot share."
          />
          <div className="space-y-5 border-t border-line-200 pt-8 text-[16px] leading-relaxed text-ink-700 md:border-t-0 md:pt-0">
            <p>
              Most of the value GDPVision prices is held up by what government cannot see quickly
              enough: spend with no measured outcome, sectors without an owner, decisions waiting
              months for a number. The figures that answer those questions already exist, locked in
              ministries.
            </p>
            <p>
              The Vault lets them be used within days rather than months, without being exposed. In
              the Decision Brief, figures that began as <em>assumptions</em> can become{" "}
              <em>Grade A evidence</em>, and the verdict rests on the country's own record.
            </p>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <SectionHeader
            eyebrow="Security you can inspect"
            title="Designed so that custody never changes hands."
            lede="No system is beyond attack. The Vault is built so that private data stays in the government's custody, and every attempt to move it is either impossible by design or recorded and approved."
          />
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
          <SectionHeader
            eyebrow="Managed from GDPVision"
            title="The Vault stays in the government's building. A small authorised team can use it through GDPVision."
            lede="Officials request an analysis, follow its progress, approve what may leave, and read the result beside the public evidence. GDPVision sees descriptions, requests, and approved findings—never the private records themselves."
          />
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE.map((s) => (
              <div key={s.head} className="border-t border-line-200 pt-5">
                <div className={MICRO}>{s.head}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRIEFING */}
      <section id="vault-briefing" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-24">
          <SectionHeader
            eyebrow="Request a briefing"
            title="A confidential briefing on the Vault for your government."
            lede="Tell us which ministry holds the data and the decision it should inform. A principal from OPEN Interactive will respond through your official email."
          />
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
