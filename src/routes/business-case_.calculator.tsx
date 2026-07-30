import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { Illustration } from "@/components/marketing/Illustration";
import { ValueCalculator } from "@/components/calculator/ValueCalculator";
import artInstrument from "@/assets/illustrations/bc-instrument.jpg.asset.json";
import ogImage from "@/assets/gdpvision-og.jpg";

const SITE_URL = "https://gdpvision.com";
const TITLE = "Sovereign value instrument — model the GDP case for GDPVision";
const DESCRIPTION =
  "An interactive, AI-assisted model of what instrumented decision-making is worth to a small open economy: chamber-by-chamber adoption, year-three GDP uplift, return on cost, and a one-page justification you can carry into Cabinet.";

export const Route = createFileRoute("/business-case_/calculator")({
  head: () => {
    const absoluteOg = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: `${SITE_URL}/business-case/calculator` },
        { property: "og:image", content: absoluteOg },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: absoluteOg },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/business-case/calculator` }],
    };
  },
  component: CalculatorPage,
});

function CalculatorPage() {
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
                Instrument · Value model v1
              </div>
              <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
              <h1 className="mt-5 max-w-3xl font-serif text-[30px] leading-[1.08] tracking-tight text-ink-950 sm:text-[40px] sm:leading-[1.05] md:text-[52px]">
                What is a decision worth when it is taken on time?
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
                Set your economy, answer four questions from memory, and stand up each chamber as
                far as you intend to. The verdict updates as you move. Every figure is traceable,
                the arithmetic is open, and total claimed uplift is capped at 1.2 per cent of GDP —
                a decision-framing model, not a forecast.
              </p>
            </div>
            <div className="hidden justify-self-end md:block">
              <Illustration src={artInstrument.url} variant="spot" />
            </div>
          </div>
        </div>
      </section>

      <ValueCalculator />
      <FloatingBackToTop />
    </MarketingShell>
  );
}
