import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import artArithmometer from "@/assets/illustrations/bc-arithmometer.jpg.asset.json";
import { ValueCalculator } from "@/components/calculator/ValueCalculator";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { Illustration } from "@/components/marketing/Illustration";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const SITE_URL = "https://gdpvision.com";
const TITLE = "The Decision Brief — estimate the value of faster government decisions | GDPVision";
const DESCRIPTION =
  "Choose a country and review the value held back by late decisions, unmeasured spending, and sectors without an owner. Every figure is capped, sourced, and ready to print.";

export const Route = createFileRoute("/business-case_/brief")({
  validateSearch: z.object({
    country: z.string().length(3).optional(),
    cfg: z.string().max(120).optional(),
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/business-case/brief` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/business-case/brief` }],
  }),
  component: BriefPage,
});

function BriefPage() {
  const { country, cfg } = Route.useSearch();
  return (
    <MarketingShell>
      <section className="border-b border-line-200 print:hidden">
        <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-6 sm:py-16 md:px-10 md:py-20">
          <Link
            to="/business-case"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to the decision paper
          </Link>

          <div className="mt-8 grid gap-10 md:grid-cols-[1fr_300px] md:items-center">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                 Guided public estimate · The Decision Brief
              </div>
              <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
              <h1 className="mt-5 max-w-3xl font-serif text-[30px] leading-[1.08] tracking-tight text-ink-950 sm:text-[40px] sm:leading-[1.05] md:text-[52px]">
                Estimate what faster, better-governed decisions could be worth.
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
                Choose a country. GDPVision begins with sourced public records and clearly marked
                reference assumptions. It then suggests an order for the ten working areas. Every
                figure can be checked, and the total estimated benefit cannot exceed 1.2 per cent of
                GDP. During a government engagement, authorised national records replace assumptions
                and create an approved starting point. This tool helps frame a decision; it does not
                predict the future.
              </p>
            </div>
            <div className="hidden justify-self-end md:block">
              <Illustration src={artArithmometer.url} variant="spot" />
            </div>
          </div>
        </div>
      </section>

      <ValueCalculator initialCountry={country?.toUpperCase()} initialConfig={cfg} />
      <FloatingBackToTop />
    </MarketingShell>
  );
}
