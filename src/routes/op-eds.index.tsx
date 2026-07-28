import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { Illustration } from "@/components/marketing/Illustration";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { chamberByIndex } from "@/lib/chambers";
import { OP_EDS, OP_ED_AUTHOR, isReadable } from "@/lib/op-eds/content";

const SITE_URL = "https://gdpvision.com";
const TITLE = "The writing — arguments for principals | GDPVision";
const DESCRIPTION =
  "Nine short, sourced arguments on how a small state can govern its own economy: the ledger, the revenue cliff, Cabinet time, and the manifesto as a delivery contract.";

export const Route = createFileRoute("/op-eds/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/op-eds` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/op-eds` }],
  }),
  component: OpEdsIndex,
});

function OpEdsIndex() {
  return (
    <MarketingShell>
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-6 py-20 md:px-10 md:py-28">
          <SectionHeader
            eyebrow="The writing"
            title="Nine arguments, written for principals."
            lede="Each piece takes about twelve minutes and carries its sources on the page. Nothing here is withheld to make a point — the evidence is visible before you give us a name."
          />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10 md:py-20">
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
            {OP_EDS.map((op) => {
              const chamber = chamberByIndex(op.chamber);
              const accent = chamber?.accentVar ?? "--sector-01";
              const ready = isReadable(op);

              const body = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
                      Chamber {op.chamber} · {chamber?.title ?? op.chamberName}
                    </div>
                    <Illustration src={op.emblem} variant="mark" className="shrink-0 !w-[104px]" />
                  </div>
                  <h2 className="mt-3 font-serif text-[27px] leading-tight text-ink-950">
                    {op.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-700">
                    {op.standfirst}
                  </p>
                  <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
                    {ready ? "Read the argument →" : "In preparation"}
                  </div>
                </>
              );

              return (
                <article
                  key={op.slug}
                  className="relative border-t border-b border-line-200 bg-paper-0"
                >
                  <div
                    aria-hidden
                    className="absolute left-0 top-0 h-full w-[2px]"
                    style={{ background: `var(${accent})` }}
                  />
                  {ready ? (
                    <Link
                      to="/op-eds/$slug"
                      params={{ slug: op.slug }}
                      className="block py-6 pl-6 pr-5"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="py-6 pl-6 pr-5 opacity-70">{body}</div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mt-20 border-t border-line-200 pt-10">
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700">
              {OP_ED_AUTHOR.note}
            </p>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-700">
              Procuring this?{" "}
              <Link to="/business-case" className="underline underline-offset-4 hover:text-ink-950">
                Read the business case →
              </Link>
            </p>
            <a
              href="/#briefing"
              className="btn-secondary px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] mt-6 inline-flex"
            >
              Request a Cabinet briefing
            </a>
          </div>

        </div>
      </section>
      <FloatingBackToTop />
    </MarketingShell>
  );
}
