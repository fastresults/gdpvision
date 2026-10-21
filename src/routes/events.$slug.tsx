import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, MapPin, Users } from "lucide-react";
import { getPublicEvent } from "@/lib/events/events.functions";
import { FORMAT_LABEL, placesLeft, registrationWindow, isUpcoming } from "@/lib/events/rules";
import { COLOUR_BG, COLOUR_TEXT, Countdown, formatEventDate, PlaceholderBadge } from "@/components/events/EventParts";
import { RegisterForm } from "@/components/events/RegisterForm";
import { cn } from "@/lib/utils";

const SITE_URL = "https://gdpvision.com";
const detailQuery = (slug: string) =>
  queryOptions({ queryKey: ["events", "detail", slug], queryFn: () => getPublicEvent({ data: { slug } }) });

export const Route = createFileRoute("/events/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(detailQuery(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Event unavailable — GDP Events" }, { name: "robots", content: "noindex" }] };
    const ev = loaderData.event;
    const title = `${ev.title} — GDP Events`;
    const desc = ev.summary ?? ev.tagline ?? "A GDPVision event.";
    const img = ev.hero_url ? (ev.hero_url.startsWith("http") ? ev.hero_url : SITE_URL + ev.hero_url) : null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="ev-display text-[72px]">Event not found</h1>
      <Link to="/events" className="ev-btn-dark mt-8">All events</Link>
    </div>
  ),
  component: EventPage,
});

function linkTarget(l: { kind: string; ref: string }) {
  switch (l.kind) {
    case "chamber":
      return { href: "/#instrument", kicker: `Chamber ${l.ref}` };
    case "index":
      return { href: "/#measures", kicker: `Index · ${l.ref}` };
    case "op_ed":
      return { href: `/op-eds/${encodeURIComponent(l.ref)}`, kicker: "Op-ed" };
    case "country":
      return { href: "/record", kicker: `Country · ${l.ref}` };
    default:
      return { href: l.ref.startsWith("/") ? l.ref : "/", kicker: "GDPVision" };
  }
}

const TILE_COLOURS = ["bg-ev-sea", "bg-ev-mango", "bg-ev-palm text-ev-paper", "bg-ev-coral"];

function EventPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(slug));
  if (!data) return null;
  const { event: ev, sessions, speakers, links, taken } = data;
  const partners = (data as { partners?: { id: string; name: string; tier: string | null; logo_url: string | null; url: string | null }[] }).partners ?? [];
  const regOpen = registrationWindow(ev) === "open";
  const left = placesLeft(ev.capacity, taken);
  const upcoming = isUpcoming(ev);

  return (
    <>
      <section className={cn("relative border-b-4 border-ev-ink", COLOUR_BG[ev.colour], COLOUR_TEXT[ev.colour])}>
        {ev.hero_url && (
          <div className="relative h-[46vh] min-h-[320px] overflow-hidden border-b-4 border-ev-ink">
            <img src={ev.hero_url} alt="" width={1600} height={912} className="h-full w-full object-cover" />
            <div aria-hidden className={cn("absolute inset-0 opacity-30 mix-blend-multiply", COLOUR_BG[ev.colour])} />
            {ev.is_placeholder && (
              <div className="absolute left-5 top-5"><PlaceholderBadge /></div>
            )}
          </div>
        )}
        <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8">
          <div className="text-[13px] font-bold uppercase tracking-wider">
            {FORMAT_LABEL[ev.format]}{ev.theme ? ` · ${ev.theme}` : ""}
          </div>
          <h1 className="ev-display ev-rise mt-3 max-w-[16ch] text-[64px] md:text-[120px]">{ev.title}</h1>
          {ev.tagline && <p className="mt-5 max-w-2xl text-[20px] font-semibold">{ev.tagline}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-6 text-[15px] font-semibold">
            <span className="flex items-center gap-2"><CalendarDays size={18} /> {formatEventDate(ev.starts_at, ev.starts_at ? { weekday: "short" } : {})}{ev.ends_at && ev.starts_at && formatEventDate(ev.ends_at) !== formatEventDate(ev.starts_at) ? ` – ${formatEventDate(ev.ends_at)}` : ""}</span>
            {(ev.venue || ev.city) && <span className="flex items-center gap-2"><MapPin size={18} /> {[ev.venue, ev.city].filter(Boolean).join(", ")}</span>}
            {left != null && upcoming && <span className="flex items-center gap-2"><Users size={18} /> {left > 0 ? `${left} places left` : "Full · waitlist open"}</span>}
          </div>
          {upcoming && <div className="mt-8"><Countdown iso={ev.starts_at} /></div>}
        </div>
      </section>

      <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-16 md:px-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-16">
          {(ev.summary || ev.body) && (
            <section>
              {ev.summary && <p className="text-[22px] font-semibold leading-snug">{ev.summary}</p>}
              {ev.body && (
                <div className="mt-5 space-y-2 text-[17px] leading-relaxed">
                  {ev.body.replace(/\*\*/g, "").split(/\n+/).filter((l) => l.trim()).map((l, i) => (
                    <p key={i}>{l.replace(/^-\s+/, "• ")}</p>
                  ))}
                </div>
              )}
            </section>
          )}

          {sessions.length > 0 && (
            <section>
              <h2 className="ev-display text-[56px]">Agenda</h2>
              <ol className="mt-6 space-y-4">
                {sessions.map((s, i) => (
                  <li key={s.id} className="ev-rise flex gap-5 rounded-3xl border-4 border-ev-ink bg-ev-paper p-5" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="ev-display w-20 shrink-0 text-[32px] text-ev-coral">
                      {s.starts_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(s.starts_at)) : String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <h3 className="text-[19px] font-bold">{s.title}</h3>
                      {s.description && <p className="mt-1 text-[15px]">{s.description}</p>}
                      {s.speaker_names.length > 0 && <p className="mt-2 text-[13px] font-semibold opacity-70">{s.speaker_names.join(", ")}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {speakers.length > 0 && (
            <section>
              <h2 className="ev-display text-[56px]">Speakers</h2>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                {speakers.map((sp, i) => (
                  <li key={sp.id} className={cn("rounded-3xl border-4 border-ev-ink p-5", TILE_COLOURS[i % TILE_COLOURS.length])}>
                    <div className="ev-display text-[30px]">{sp.name}</div>
                    <div className="mt-1 text-[14px] font-semibold">{[sp.role, sp.organisation].filter(Boolean).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {partners.length > 0 && (
            <section>
              <h2 className="ev-display text-[56px]">Partners</h2>
              <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {partners.map((p) => {
                  const inner = (
                    <>
                      <div className="flex h-16 items-center justify-center">
                        {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="max-h-16 max-w-full object-contain" /> : <span className="text-center text-[15px] font-bold">{p.name}</span>}
                      </div>
                      <div className="mt-3 text-center text-[13px] font-semibold">{p.name}</div>
                      {p.tier && <div className="text-center text-[11px] font-bold uppercase tracking-wider opacity-60">{p.tier}</div>}
                    </>
                  );
                  return (
                    <li key={p.id} className="rounded-2xl border-4 border-ev-ink bg-ev-paper p-4">
                      {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="block">{inner}</a> : inner}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {links.length > 0 && (
            <section>
              <h2 className="ev-display text-[56px]">From the Second Brain</h2>
              <p className="mt-2 max-w-xl text-[15px]">The Chambers, indexes and records this event draws on.</p>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {links.map((l, i) => {
                  const t = linkTarget(l);
                  return (
                    <li key={l.id}>
                      <a href={t.href} className={cn("ev-tile group flex h-full items-start justify-between gap-4 rounded-3xl border-4 border-ev-ink p-5", TILE_COLOURS[i % TILE_COLOURS.length])}>
                        <span>
                          <span className="block text-[12px] font-bold uppercase tracking-wider opacity-80">{t.kicker}</span>
                          <span className="ev-display mt-2 block text-[30px]">{l.label ?? l.ref}</span>
                        </span>
                        <ArrowUpRight size={24} className="shrink-0" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {ev.hosts.length > 0 && (
            <section>
              <h2 className="ev-display text-[40px]">Hosted by</h2>
              <p className="mt-2 text-[17px] font-semibold">{ev.hosts.join(" · ")}</p>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          {upcoming && ev.registration_url ? (
            <div className="rounded-3xl border-4 border-ev-ink bg-ev-paper p-6">
              <h3 className="ev-display text-[36px]">Join this summit</h3>
              <p className="mt-2 text-[15px]">Registration is handled on the official summit website.</p>
              <a href={ev.registration_url} target="_blank" rel="noreferrer" className="ev-btn-primary mt-5">Register on the summit site <ArrowUpRight size={18} /></a>
              {ev.site_url && <a href={ev.site_url} target="_blank" rel="noreferrer" className="mt-4 block text-[15px] font-bold underline">Visit summit site</a>}
            </div>
          ) : upcoming ? (
            <RegisterForm slug={ev.slug} open={regOpen} />
          ) : (
            <div className="rounded-3xl border-4 border-ev-ink bg-ev-paper p-6">
              <h3 className="ev-display text-[36px]">This event has finished</h3>
              {ev.recording_url ? (
                <a href={ev.recording_url} target="_blank" rel="noreferrer" className="ev-btn-primary mt-5">Watch the recording</a>
              ) : (
                <p className="mt-2 text-[15px]">A recording is available on request.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
