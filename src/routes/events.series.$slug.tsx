import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { getPublicSeries } from "@/lib/events/events.functions";
import { isUpcoming } from "@/lib/events/rules";
import { COLOUR_BG, COLOUR_TEXT, EventTile, formatEventDate } from "@/components/events/EventParts";

const seriesQuery = (slug: string) =>
  queryOptions({ queryKey: ["events", "series", slug], queryFn: () => getPublicSeries({ data: { slug } }) });

export const Route = createFileRoute("/events/series/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(seriesQuery(params.slug));
    if (!d) throw notFound();
    return { name: d.series.name, summary: d.series.summary, hero: d.events.find((e) => e.hero_url)?.hero_url ?? null };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — GDP Events` : "Summit series — GDP Events";
    const description = loaderData?.summary ?? "Every edition of this GDP Events summit, upcoming and past.";
    const img = loaderData?.hero && loaderData.hero.startsWith("https://") ? loaderData.hero : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-[1400px] px-5 py-24 md:px-8">
      <h1 className="ev-display text-[64px]">Series not found</h1>
      <Link to="/events" className="ev-btn-dark mt-6 inline-flex">All events</Link>
    </div>
  ),
  component: SeriesPage,
});

function SeriesPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(seriesQuery(slug));
  if (!data) return null;
  const { series, events, media } = data;
  const upcoming = events.filter((e) => isUpcoming(e));
  const past = events.filter((e) => !isUpcoming(e)).reverse();
  return (
    <>
      <section className={`border-b-4 border-ev-ink ${COLOUR_BG[series.colour]} ${COLOUR_TEXT[series.colour]}`}>
        <div className="mx-auto max-w-[1400px] px-5 py-16 md:px-8 md:py-20">
          <div className="inline-block rounded-full border-4 border-ev-ink bg-ev-paper px-4 py-1.5 text-[13px] font-bold uppercase tracking-wider text-ev-ink">
            {series.short_name ?? "Summit"} · {series.sector}
          </div>
          <h1 className="ev-display mt-6 max-w-[16ch] text-[64px] md:text-[110px]">{series.name}</h1>
          {series.summary && <p className="mt-6 max-w-2xl text-[18px] font-medium">{series.summary}</p>}
          <a href={series.site_url} target="_blank" rel="noreferrer" className="ev-btn-dark mt-8 inline-flex items-center gap-2">
            Visit summit site <ArrowUpRight size={18} />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-8">
        <h2 className="ev-display text-[56px]">Next edition</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-[17px] font-medium">The next edition will be announced soon.</p>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {upcoming.map((e, i) => <EventTile key={e.slug} ev={e} index={i} />)}
          </div>
        )}
      </section>

      <section className="border-y-4 border-ev-ink bg-ev-mango">
        <div className="mx-auto max-w-[1400px] px-5 py-16 md:px-8">
          <h2 className="ev-display text-[56px]">Past editions</h2>
          {past.length === 0 ? (
            <p className="mt-4 text-[17px] font-medium">This is the series' first edition. Recordings and photos will appear here afterwards.</p>
          ) : (
            <ul className="mt-6 divide-y-4 divide-ev-ink border-y-4 border-ev-ink">
              {past.map((e) => (
                <li key={e.slug}>
                  <Link to="/events/$slug" params={{ slug: e.slug }} className="flex flex-wrap justify-between gap-4 py-5">
                    <span className="ev-display text-[36px]">{e.title}</span>
                    <span className="font-semibold">{formatEventDate(e.starts_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {media.filter((m) => m.kind === "photo").length > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {media.filter((m) => m.kind === "photo").map((m) => (
                <figure key={m.url} className="overflow-hidden rounded-2xl border-4 border-ev-ink bg-ev-paper">
                  <img src={m.url} alt={m.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  {(m.caption || m.credit) && <figcaption className="p-2 text-[12px]">{m.caption}{m.credit ? ` · ${m.credit}` : ""}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
