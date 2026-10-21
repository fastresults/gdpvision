import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listPublicEvents, listPublicSeries } from "@/lib/events/events.functions";
import { isUpcoming, FORMAT_LABEL } from "@/lib/events/rules";
import { COLOUR_BG, COLOUR_TEXT, Countdown, EventTile, formatEventDate, PlaceholderBadge } from "@/components/events/EventParts";
import { cn } from "@/lib/utils";

const eventsQuery = queryOptions({ queryKey: ["events", "public"], queryFn: () => listPublicEvents() });
const seriesQuery = queryOptions({ queryKey: ["events", "series"], queryFn: () => listPublicSeries() });

const TITLE = "GDP Events — summits, roundtables and briefings";
const DESCRIPTION =
  "Register for GDPVision summits, ministers' roundtables and public briefings across the Caribbean, where national economic decisions are tested in the open.";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(eventsQuery), context.queryClient.ensureQueryData(seriesQuery)]),
  component: EventsIndex,
});

function EventsIndex() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data: series } = useSuspenseQuery(seriesQuery);
  const [format, setFormat] = useState<string>("all");
  const [theme, setTheme] = useState<string>("all");

  const upcoming = events.filter((e) => isUpcoming(e));
  const past = events.filter((e) => !isUpcoming(e)).reverse();
  const themes = useMemo(() => Array.from(new Set(events.map((e) => e.theme).filter(Boolean))) as string[], [events]);
  const filtered = upcoming.filter((e) => (format === "all" || e.format === format) && (theme === "all" || e.theme === theme));
  const next = upcoming[0];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b-4 border-ev-ink">
        <div aria-hidden className="absolute inset-0 grid grid-cols-4">
          <span className="bg-ev-sea" />
          <span className="bg-ev-coral" />
          <span className="bg-ev-mango" />
          <span className="bg-ev-palm" />
        </div>
        <div className="relative mx-auto max-w-[1400px] px-5 py-16 md:px-8 md:py-24">
          <div className="ev-rise inline-block rounded-full border-4 border-ev-ink bg-ev-paper px-4 py-1.5 text-[13px] font-bold uppercase tracking-wider">
            GDPVision · Events
          </div>
          <h1 className="ev-display ev-rise mt-6 max-w-[14ch] text-[72px] text-ev-ink sm:text-[110px] md:text-[150px]" style={{ animationDelay: "120ms" }}>
            Decide it together.
          </h1>
          <p className="ev-rise mt-6 max-w-xl rounded-2xl border-4 border-ev-ink bg-ev-paper p-5 text-[17px] font-medium leading-relaxed" style={{ animationDelay: "240ms" }}>
            Summits, roundtables and public briefings where governments, investors and citizens test national economic
            choices with live data from the Second Brain.
          </p>
          {next && (
            <div className="ev-rise mt-8 flex flex-wrap items-center gap-6" style={{ animationDelay: "360ms" }}>
              <Countdown iso={next.starts_at} />
              <Link to="/events/$slug" params={{ slug: next.slug }} className="ev-btn-dark">
                Next: {next.title}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b-4 border-ev-ink bg-ev-night py-3 text-ev-mango" aria-hidden>
        <div className="ev-marquee flex w-max gap-10 whitespace-nowrap">
          {[...upcoming, ...upcoming, ...upcoming, ...upcoming].map((e, i) => (
            <span key={i} className="ev-display text-[28px]">
              {e.title} · {formatEventDate(e.starts_at)} ✦
            </span>
          ))}
        </div>
      </div>

      {/* SERIES */}
      <section id="series" className="mx-auto max-w-[1400px] scroll-mt-24 px-5 pt-16 md:px-8">
        <h2 className="ev-display text-[64px] md:text-[88px]">The summits</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {series.map((s) => {
            const eds = events.filter((e) => e.series_id === s.id);
            const nextEd = eds.find((e) => isUpcoming(e));
            return (
              <Link
                key={s.slug}
                to="/events/series/$slug"
                params={{ slug: s.slug }}
                className={cn("ev-tile flex min-h-[200px] flex-col justify-between rounded-3xl border-4 border-ev-ink p-5", COLOUR_BG[s.colour], COLOUR_TEXT[s.colour])}
              >
                <div className="text-[12px] font-bold uppercase tracking-wider opacity-80">{s.short_name} · {s.sector}</div>
                <h3 className="ev-display text-[30px] leading-[0.95]">{s.name}</h3>
                <div className="text-[13px] font-semibold">
                  {nextEd ? `Next: ${formatEventDate(nextEd.starts_at)}` : eds.length ? `${eds.length} edition${eds.length > 1 ? "s" : ""}` : "Announcing soon"}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* UPCOMING */}
      <section id="upcoming" className="mx-auto max-w-[1400px] scroll-mt-24 px-5 py-16 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="ev-display text-[64px] md:text-[88px]">Upcoming</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter events">
            {["all", "in_person", "hybrid", "online"].map((f) => (
              <FilterChip key={f} active={format === f} onClick={() => setFormat(f)}>
                {f === "all" ? "Every format" : FORMAT_LABEL[f]}
              </FilterChip>
            ))}
            <span className="mx-1 w-[3px] bg-ev-ink" aria-hidden />
            <FilterChip active={theme === "all"} onClick={() => setTheme("all")}>Every theme</FilterChip>
            {themes.map((t) => (
              <FilterChip key={t} active={theme === t} onClick={() => setTheme(t)}>{t}</FilterChip>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="mt-10 rounded-3xl border-4 border-dashed border-ev-ink p-10 text-center text-[17px] font-medium">
            No upcoming events match these filters yet.
          </p>
        ) : (
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {filtered.map((e, i) => (
              <EventTile key={e.slug} ev={e} index={i} large={i === 0 && filtered.length > 2} />
            ))}
          </div>
        )}
      </section>

      {/* PAST */}
      <section id="past" className="scroll-mt-24 border-y-4 border-ev-ink bg-ev-mango">
        <div className="mx-auto max-w-[1400px] px-5 py-16 md:px-8">
          <h2 className="ev-display text-[64px] md:text-[88px]">Past &amp; recordings</h2>
          {past.length === 0 ? (
            <p className="mt-6 text-[17px] font-medium">Past events will appear here.</p>
          ) : (
            <ul className="mt-8 divide-y-4 divide-ev-ink border-y-4 border-ev-ink">
              {past.map((e) => (
                <li key={e.slug}>
                  <Link
                    to="/events/$slug"
                    params={{ slug: e.slug }}
                    className="group flex flex-wrap items-center justify-between gap-4 py-5 hover:bg-ev-paper/40"
                  >
                    <span className="ev-display text-[36px] md:text-[48px] group-hover:translate-x-2 transition-transform motion-reduce:transition-none">
                      {e.title}
                    </span>
                    <span className="flex items-center gap-3 text-[14px] font-semibold">
                      {e.is_placeholder && <PlaceholderBadge />}
                      {formatEventDate(e.starts_at)} · {FORMAT_LABEL[e.format]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* HOST CTA */}
      <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-8">
        <div className="grid items-center gap-8 rounded-[2rem] border-4 border-ev-ink bg-ev-coral p-8 md:grid-cols-[2fr_1fr] md:p-14">
          <h2 className="ev-display text-[56px] md:text-[84px]">Bring GDP Events to your country.</h2>
          <Link to="/events/host" className="ev-btn-dark justify-self-start md:justify-self-end">
            Host an event
          </Link>
        </div>
      </section>
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border-[3px] border-ev-ink px-4 py-1.5 text-[14px] font-bold transition-colors",
        active ? "bg-ev-ink text-ev-paper" : "bg-ev-paper hover:bg-ev-mango",
      )}
    >
      {children}
    </button>
  );
}
