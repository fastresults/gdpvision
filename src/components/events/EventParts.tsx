import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_LABEL } from "@/lib/events/rules";

export const COLOUR_BG: Record<string, string> = {
  sea: "bg-ev-sea",
  coral: "bg-ev-coral",
  mango: "bg-ev-mango",
  palm: "bg-ev-palm",
  night: "bg-ev-night",
};
export const COLOUR_TEXT: Record<string, string> = {
  sea: "text-ev-ink",
  coral: "text-ev-ink",
  mango: "text-ev-ink",
  palm: "text-ev-paper",
  night: "text-ev-paper",
};

export type EventCardData = {
  slug: string;
  title: string;
  tagline: string | null;
  starts_at: string | null;
  date_tba?: boolean;
  city: string | null;
  venue: string | null;
  format: string;
  theme: string | null;
  hero_url: string | null;
  colour: string;
  is_placeholder: boolean;
  site_url?: string | null;
};

export function formatEventDate(iso: string | null, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "Dates to be announced";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...opts }).format(new Date(iso));
}

export function DateBlock({ iso, className }: { iso: string | null; className?: string }) {
  if (!iso)
    return (
      <div className={cn("ev-display text-center leading-none", className)}>
        <div className="text-[36px]">TBA</div>
        <div className="mt-1 text-[12px] opacity-70">Dates soon</div>
      </div>
    );
  const d = new Date(iso);
  return (
    <div className={cn("ev-display text-center leading-none", className)}>
      <div className="text-[52px]">{d.getUTCDate()}</div>
      <div className="text-[20px]">{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(d)}</div>
      <div className="mt-1 text-[14px] opacity-70">{d.getUTCFullYear()}</div>
    </div>
  );
}

export function PlaceholderBadge() {
  return (
    <span className="inline-block rounded-full bg-ev-paper px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ev-ink">
      Sample event
    </span>
  );
}

/** Short display name for a summit website, e.g. "cis27.com". */
export function siteHost(url: string) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}

/** Opens the summit's own website in a new tab. Sits above stretched card links. */
export function SiteLink({ url, name, className }: { url: string | null | undefined; name: string; className?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Visit the ${name} website at ${siteHost(url)} (opens in a new tab)`}
      className={cn(
        "relative z-10 inline-flex w-fit items-center gap-1.5 rounded-full border-[3px] border-ev-ink bg-ev-paper px-3 py-1 text-[13px] font-bold text-ev-ink transition-colors hover:bg-ev-ink hover:text-ev-paper",
        className,
      )}
    >
      Visit {siteHost(url)} <ArrowUpRight size={14} aria-hidden />
    </a>
  );
}

export function EventTile({ ev, index = 0, large = false }: { ev: EventCardData; index?: number; large?: boolean }) {
  return (
    <div
      className={cn(
        "ev-tile ev-rise group relative flex flex-col overflow-hidden rounded-3xl border-4 border-ev-ink",
        COLOUR_BG[ev.colour] ?? "bg-ev-sea",
        COLOUR_TEXT[ev.colour] ?? "text-ev-ink",
        large && "md:col-span-2",
      )}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {ev.hero_url && (
        <div className={cn("relative overflow-hidden border-b-4 border-ev-ink", large ? "aspect-[21/9]" : "aspect-[16/9]")}>
          <img
            src={ev.hero_url}
            alt=""
            loading={index < 2 ? "eager" : "lazy"}
            width={1600}
            height={912}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
          />
          <div className="absolute left-4 top-4 flex gap-2">
            {ev.is_placeholder && <PlaceholderBadge />}
          </div>
        </div>
      )}
      <div className="flex flex-1 gap-5 p-6">
        <DateBlock iso={ev.starts_at} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider opacity-80">
            {FORMAT_LABEL[ev.format] ?? ev.format}
            {ev.theme ? ` · ${ev.theme}` : ""}
          </div>
          <h3 className={cn("ev-display mt-2", large ? "text-[44px] md:text-[60px]" : "text-[36px]")}>
            <Link to="/events/$slug" params={{ slug: ev.slug }} className="after:absolute after:inset-0 after:content-['']">
              {ev.title}
            </Link>
          </h3>
          {ev.tagline && <p className="mt-3 text-[15px] font-medium leading-snug">{ev.tagline}</p>}
          {(ev.city || ev.venue) && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] opacity-80">
              <MapPin size={14} /> {ev.city ?? ev.venue}
            </p>
          )}
          <SiteLink url={ev.site_url} name={ev.title} className="mt-4" />
        </div>
        <ArrowUpRight
          size={28}
          className="shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 motion-reduce:transition-none"
        />
      </div>
    </div>
  );
}

/** Live countdown to an event start; static when reduced motion is preferred. */
export function Countdown({ iso }: { iso: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setInterval(() => setNow(Date.now()), reduce ? 60_000 : 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now == null || !iso) return null;
  const diff = Math.max(0, new Date(iso).getTime() - now);
  const parts = [
    { v: Math.floor(diff / 86_400_000), l: "days" },
    { v: Math.floor((diff / 3_600_000) % 24), l: "hours" },
    { v: Math.floor((diff / 60_000) % 60), l: "mins" },
    { v: Math.floor((diff / 1000) % 60), l: "secs" },
  ];
  return (
    <div className="flex gap-3" aria-label={`${parts[0].v} days to go`}>
      {parts.map((p) => (
        <div key={p.l} className="min-w-[72px] rounded-2xl border-4 border-ev-ink bg-ev-paper px-3 py-2 text-center text-ev-ink">
          <div className="ev-display text-[40px] tabular-nums">{String(p.v).padStart(2, "0")}</div>
          <div className="text-[11px] font-bold uppercase tracking-wider">{p.l}</div>
        </div>
      ))}
    </div>
  );
}
