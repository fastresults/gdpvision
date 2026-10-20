import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/marketing/Wordmark";
import { scrollToTop } from "@/lib/utils";

export const Route = createFileRoute("/events")({
  head: () => ({
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Figtree:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: EventsLayout,
});

const LINKS = [
  { to: "/events", hash: undefined, label: "Upcoming" },
  { to: "/events", hash: "past", label: "Past & recordings" },
  { to: "/events/host", hash: undefined, label: "Host an event" },
] as const;

function EventsLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="theme-events min-h-dvh overflow-x-clip antialiased">
      <a href="#ev-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ev-night focus:px-4 focus:py-2 focus:text-ev-paper">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b-4 border-ev-ink bg-ev-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" onClick={() => scrollToTop()} aria-label="GDPVision home" className="hidden sm:block">
              <Wordmark className="h-8" />
            </Link>
            <span aria-hidden className="hidden h-8 w-[3px] bg-ev-ink sm:block" />
            <Link to="/events" className="ev-display flex items-center gap-2 text-[30px]">
              <span className="flex gap-1" aria-hidden>
                <span className="h-3 w-3 rounded-full bg-ev-coral" />
                <span className="h-3 w-3 rounded-full bg-ev-mango" />
                <span className="h-3 w-3 rounded-full bg-ev-sea" />
              </span>
              GDP Events
            </Link>
          </div>
          <nav aria-label="Events" className="hidden items-center gap-6 md:flex">
            {LINKS.map((l) => (
              <Link key={l.label} to={l.to} hash={l.hash} className="text-[15px] font-semibold hover:text-ev-coral">
                {l.label}
              </Link>
            ))}
            <Link to="/events" hash="upcoming" className="ev-btn-primary !py-2.5 !text-[15px]">
              Register
            </Link>
          </nav>
          <button
            type="button"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {open && (
          <nav aria-label="Events" className="border-t-2 border-ev-ink px-5 pb-5 md:hidden">
            {LINKS.map((l) => (
              <Link key={l.label} to={l.to} hash={l.hash} onClick={() => setOpen(false)} className="ev-display block py-3 text-[32px]">
                {l.label}
              </Link>
            ))}
            <Link to="/" onClick={() => setOpen(false)} className="mt-2 block text-[14px] font-semibold underline">
              Back to GDPVision
            </Link>
          </nav>
        )}
      </header>
      <main id="ev-main">
        <Outlet />
      </main>
      <footer className="bg-ev-night text-ev-paper">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-14 md:grid-cols-[2fr_1fr_1fr] md:px-8">
          <div>
            <div className="ev-display text-[64px] md:text-[96px]">See you there.</div>
            <p className="mt-4 max-w-md text-[15px] opacity-80">
              GDP Events bring governments, investors and citizens together to test national decisions in the open.
            </p>
          </div>
          <ul className="space-y-3 text-[15px] font-semibold">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} hash={l.hash} className="hover:text-ev-mango">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="space-y-3 text-[15px] font-semibold">
            <li><Link to="/" className="hover:text-ev-mango">GDPVision home</Link></li>
            <li><Link to="/record" className="hover:text-ev-mango">The National Record</Link></li>
            <li><Link to="/present" className="hover:text-ev-mango">The briefing</Link></li>
          </ul>
        </div>
        <div aria-hidden className="flex h-3">
          <span className="flex-1 bg-ev-sea" />
          <span className="flex-1 bg-ev-coral" />
          <span className="flex-1 bg-ev-mango" />
          <span className="flex-1 bg-ev-palm" />
        </div>
      </footer>
    </div>
  );
}
