import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FloatingBackToTop } from "@/components/marketing/FloatingBackToTop";
import { Illustration } from "@/components/marketing/Illustration";
import { OpEdGate } from "@/components/marketing/OpEdGate";
import { chamberByIndex } from "@/lib/chambers";
import { OP_ED_AUTHOR, PUBLISHED_OP_EDS, isReadable, opEdBySlug } from "@/lib/op-eds/content";
import { useAttribution, useOpEdTracker } from "@/lib/op-eds/useAttribution";

const SITE_URL = "https://gdpvision.com";

export const Route = createFileRoute("/op-eds/$slug")({
  loader: ({ params }) => {
    const op = opEdBySlug(params.slug);
    if (!op || !isReadable(op)) throw notFound();
    return { slug: op.slug };
  },
  head: ({ params }) => {
    const op = opEdBySlug(params.slug);
    if (!op || !isReadable(op)) {
      return {
        meta: [{ title: "Not found — GDPVision" }, { name: "robots", content: "noindex" }],
      };
    }
    const url = `${SITE_URL}/op-eds/${op.slug}`;
    const og = op.ogImage;
    return {
      meta: [
        { title: `${op.title} — GDPVision` },
        { name: "description", content: op.standfirst },
        { property: "og:type", content: "article" },
        { property: "og:title", content: op.title },
        { property: "og:description", content: op.standfirst },
        { property: "og:url", content: url },
        { property: "og:image", content: og },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: op.title },
        { name: "twitter:description", content: op.standfirst },
        { name: "twitter:image", content: og },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: op.title,
            description: op.standfirst,
            image: og,
            author: { "@type": "Person", name: OP_ED_AUTHOR.name },
            publisher: { "@type": "Organization", name: "OPEN Interactive" },
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  notFoundComponent: OpEdNotFound,
  errorComponent: OpEdNotFound,
  component: OpEdPage,
});

function OpEdNotFound() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-[720px] px-6 py-32 md:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Not yet published
        </div>
        <h1 className="mt-6 font-serif text-[34px] leading-tight text-ink-950">
          This piece is still in preparation.
        </h1>
        <Link
          to="/op-eds"
          className="btn-secondary px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] mt-8 inline-flex"
        >
          The writing
        </Link>
      </div>
    </MarketingShell>
  );
}

function OpEdPage() {
  const { slug } = Route.useLoaderData();
  const op = opEdBySlug(slug)!;
  const chamber = chamberByIndex(op.chamber);
  const accentVar = chamber?.accentVar ?? "--sector-01";

  const attribution = useAttribution();
  const track = useOpEdTracker(op.slug, attribution);

  useEffect(() => {
    if (attribution.visitorKey) track("op_ed_view", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attribution.visitorKey]);

  useEffect(() => {
    const el = document.getElementById("read-the-full-argument");
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) track("op_ed_scroll_to_form", true);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op.slug]);

  const others = PUBLISHED_OP_EDS.filter((o) => o.slug !== op.slug);

  return (
    <MarketingShell>
      {/* HERO ---------------------------------------------------------- */}
      <section className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-6 py-20 md:grid-cols-[1fr_320px] md:px-10 md:py-28">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Chamber {op.chamber} · {chamber?.title ?? op.chamberName}
            </div>
            <div
              aria-hidden
              className="mt-4 h-[2px] w-16"
              style={{ background: `var(${accentVar})` }}
            />
            <h1 className="mt-6 max-w-[16ch] font-serif text-[38px] leading-[1.08] tracking-tight text-ink-950 md:text-[54px]">
              {op.title}
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">
              {op.standfirst}
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
              {op.promise}
            </p>
            <a
              href="#read-the-full-argument"
              className="btn-primary px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] mt-8 inline-flex"
            >
              Read the full argument
            </a>
          </div>
          <div className="hidden justify-self-end md:block">
            <Illustration src={op.emblem} variant="spot" />
          </div>
        </div>
      </section>

      {/* THE OPENING — ungated ----------------------------------------- */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10 md:py-20">
          <div className="max-w-[680px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              The opening
            </div>
            <div className="mt-6 space-y-6">
              {op.excerpt.map((para, i) => (
                <p
                  key={i}
                  className="font-serif text-[19px] leading-[1.65] text-ink-950 md:text-[20px]"
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THE FIGURE ----------------------------------------------------- */}
      {op.figure ? (
        <section
          className="border-b border-line-200 bg-paper-100/60"
          style={{ borderLeft: `2px solid var(${accentVar})` }}
        >
          <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
            <Illustration src={op.figure.image} variant="rule" className="mx-auto" />
            <p className="mx-auto mt-6 max-w-[720px] text-[14px] leading-relaxed text-ink-700">
              {op.figure.caption}
            </p>
          </div>
        </section>
      ) : null}

      {/* THE GATE ------------------------------------------------------- */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
          <div className="max-w-[820px]">
            <OpEdGate
              slug={op.slug}
              title={op.title}
              accentVar={accentVar}
              attribution={attribution}
              onEvent={track}
            />
          </div>
        </div>
      </section>

      {/* SOURCES — always visible --------------------------------------- */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
          <div className="max-w-[820px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Sources
            </div>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-700">
              Every figure in this piece can be checked before you give us a name.
            </p>
            <ol className="mt-8 divide-y divide-line-200 border-t border-line-200">
              {op.sources.map((s, i) => (
                <li key={i} className="flex gap-5 py-4">
                  <span className="w-6 shrink-0 pt-1 font-mono text-[11px] text-ink-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 text-[14.5px] leading-relaxed text-ink-700">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* THE CHAMBER BRIDGE --------------------------------------------- */}
      {chamber ? (
        <section className="border-b border-line-200">
          <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Where this lives in the instrument
            </div>
            <div className="mt-6 grid gap-8 md:grid-cols-[1fr_280px] md:items-center">
              <div>
                <h2 className="font-serif text-[27px] leading-tight text-ink-950">
                  Chamber {chamber.index} — {chamber.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                  {chamber.purpose}
                </p>
                <ul className="mt-5 space-y-2.5 text-[14px] leading-relaxed text-ink-700">
                  {chamber.bullets.map((b) => (
                    <li key={b} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-2 inline-block h-px w-4 flex-none"
                        style={{ background: `var(${accentVar})` }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="hidden justify-self-end md:block">
                <Illustration src={chamber.image} variant="spot" />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* THE AUTHOR ------------------------------------------------------ */}
      <section className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-6 py-14 md:px-10">
          <div className="max-w-[680px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              The author
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{OP_ED_AUTHOR.note}</p>
          </div>
        </div>
      </section>

      {/* THE OTHERS ------------------------------------------------------ */}
      {others.length > 0 ? (
        <section>
          <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              The rest of the series
            </div>
            <div className="mt-8 grid gap-x-8 gap-y-8 border-t border-line-200 pt-8 md:grid-cols-2 lg:grid-cols-3">
              {others.map((o) => (
                <OpEdCard
                  key={o.slug}
                  slug={o.slug}
                  title={o.title}
                  chamber={o.chamber}
                  standfirst={o.standfirst}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </MarketingShell>
  );
}

function OpEdCard(props: { slug: string; title: string; chamber: string; standfirst: string }) {
  const chamber = chamberByIndex(props.chamber);
  return (
    <Link
      to="/op-eds/$slug"
      params={{ slug: props.slug }}
      className="group block border-t border-line-200 pt-5"
    >
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
        <span
          aria-hidden
          className="inline-block h-[2px] w-6"
          style={{ background: `var(${chamber?.accentVar ?? "--sector-01"})` }}
        />
        Chamber {props.chamber}
      </div>
      <h3 className="mt-3 font-serif text-[21px] leading-tight text-ink-950 group-hover:text-ink-hover">
        {props.title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-700">{props.standfirst}</p>
    </Link>
  );
}
