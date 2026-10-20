import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { cn, scrollToTop } from "@/lib/utils";
import { NAV_GROUPS, type NavGroup } from "./navigation";

interface MarketingShellProps {
  children: ReactNode;
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean>(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => alive && setSignedIn(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setSignedIn(!!session);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}

function MegaMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const enter = (id: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const leave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(null), 160);
  };
  const group = NAV_GROUPS.find((g) => g.id === open);

  return (
    <div ref={wrapRef} className="hidden min-w-0 flex-1 items-center md:flex" onMouseLeave={leave}>
      <nav aria-label="Main" className="flex flex-1 items-center justify-center gap-1 lg:gap-3">
        {NAV_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-expanded={open === g.id}
            aria-controls={`mega-${g.id}`}
            onMouseEnter={() => enter(g.id)}
            onClick={() => setOpen((v) => (v === g.id ? null : g.id))}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors",
              open === g.id ? "bg-paper-100 text-ink-950" : "text-ink-500 hover:text-ink-950",
              g.events && "text-ink-950",
            )}
          >
            {g.events && <span aria-hidden className="h-2 w-2 rounded-full bg-ev-coral" />}
            {g.label}
            <ChevronDown
              size={13}
              strokeWidth={1.75}
              className={cn("transition-transform motion-reduce:transition-none", open === g.id && "rotate-180")}
            />
          </button>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
        <AuthEntry signedIn={signedIn} />
        <Link to="/" hash="briefing" className="btn-primary whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em]">
          Request a Cabinet briefing
        </Link>
      </div>

      {group && (
        <div
          id={`mega-${group.id}`}
          onMouseEnter={() => enter(group.id)}
          className="absolute inset-x-0 top-full border-b border-line-200 bg-paper-0 shadow-[0_24px_48px_-24px_rgb(8_17_31/0.25)] animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
        >
          <div className="mx-auto grid max-w-[1280px] gap-10 px-10 py-9 md:grid-cols-[1fr_2fr_1.2fr]">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{group.label}</div>
              <p className="mt-3 font-serif text-[22px] leading-snug text-ink-950">{group.intro}</p>
            </div>
            <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {group.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    hash={l.hash}
                    onClick={() => setOpen(null)}
                    className="group block rounded-md p-2 -m-2 hover:bg-paper-100"
                  >
                    <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink-950">
                      {l.label}
                      <ArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink-700">{l.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <FeaturedCard group={group} onNavigate={() => setOpen(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedCard({ group, onNavigate }: { group: NavGroup; onNavigate?: () => void }) {
  const f = group.featured;
  if (group.events) {
    return (
      <Link
        to={f.to}
        hash={f.hash}
        onClick={onNavigate}
        className="ev-tile relative block overflow-hidden rounded-2xl bg-ev-night p-6 font-ev-body text-ev-paper"
      >
        <span aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-ev-coral" />
        <span aria-hidden className="absolute -bottom-10 right-10 h-20 w-20 rounded-full bg-ev-mango" />
        <span className="relative block font-mono text-[11px] uppercase tracking-[0.18em] text-ev-mango">{f.eyebrow}</span>
        <span className="ev-display relative mt-3 block text-[34px]">{f.title}</span>
        <span className="relative mt-3 block max-w-[24ch] text-[14px] leading-relaxed">{f.body}</span>
      </Link>
    );
  }
  return (
    <Link
      to={f.to}
      hash={f.hash}
      onClick={onNavigate}
      className="block rounded-lg border border-line-200 bg-paper-50 p-6 transition-colors hover:border-ink-300"
    >
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">{f.eyebrow}</span>
      <span className="mt-3 block font-serif text-[22px] leading-snug text-ink-950">{f.title}</span>
      <span className="mt-2 block text-[13.5px] leading-relaxed text-ink-700">{f.body}</span>
      <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950">
        Open <ArrowRight size={13} />
      </span>
    </Link>
  );
}

function MobileMenu({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [section, setSection] = useState<string | null>(null);
  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--hdr,56px)] z-40 flex flex-col overflow-y-auto bg-paper-0 md:hidden">
      <nav aria-label="Main" className="flex-1 px-6 py-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="border-b border-line-100">
            <button
              type="button"
              aria-expanded={section === g.id}
              onClick={() => setSection((v) => (v === g.id ? null : g.id))}
              className="flex w-full items-center justify-between py-4 text-left font-serif text-[22px] text-ink-950"
            >
              <span className="flex items-center gap-2">
                {g.events && <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ev-coral" />}
                {g.label}
              </span>
              <ChevronDown size={18} className={cn("transition-transform", section === g.id && "rotate-180")} />
            </button>
            {section === g.id && (
              <ul className="pb-4">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} hash={l.hash} onClick={onClose} className="block py-2.5">
                      <span className="block text-[15px] font-medium text-ink-950">{l.label}</span>
                      <span className="block text-[13px] text-ink-700">{l.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <div className="py-5 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-700">
          <AuthEntry signedIn={signedIn} onNavigate={onClose} />
        </div>
      </nav>
      <div className="sticky bottom-0 border-t border-line-200 bg-paper-0 p-4">
        <Link to="/" hash="briefing" onClick={onClose} className="btn-primary w-full justify-center">
          Request a Cabinet briefing
        </Link>
      </div>
    </div>
  );
}

export function MarketingShell({ children }: MarketingShellProps) {
  const signedIn = useSignedIn();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper-0 text-ink-950 font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-950 focus:px-3 focus:py-2 focus:text-paper-0 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.16em]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line-200 bg-paper-0/95 backdrop-blur supports-[backdrop-filter]:bg-paper-0/80">
        <div className="relative flex items-center justify-between gap-6 px-4 py-2 md:px-6 md:py-3">
          <Link
            to="/"
            onClick={() => scrollToTop()}
            aria-label="GDPVision home"
            className="flex shrink-0 items-center focus-visible:outline-none"
          >
            <Wordmark className="h-[2.17rem] md:h-[2.89rem]" />
          </Link>

          <MegaMenu signedIn={signedIn} />

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="text-ink-700 hover:text-ink-950 md:hidden"
          >
            {menuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
          </button>
        </div>
        {menuOpen && <MobileMenu signedIn={signedIn} onClose={() => setMenuOpen(false)} />}
      </header>
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line-200 bg-paper-0">
      <div className="mx-auto max-w-[1280px] px-6 py-12 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <Link to="/" onClick={() => scrollToTop()} aria-label="GDPVision home">
              <Wordmark className="h-8" />
            </Link>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-ink-700">
              A government-controlled decision system delivered by OPEN Interactive through a
              confidential engagement with the authorised government of the day.
            </p>
          </div>
          {NAV_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{g.label}</div>
              <ul className="mt-4 space-y-2.5 text-[13.5px]">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} hash={l.hash} className="text-ink-700 hover:text-ink-950">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-6 border-t border-line-100 pt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
          <span>OPEN Interactive · 2009–2026</span>
          <span>Confidential — government briefing use</span>
        </div>
      </div>
    </footer>
  );
}

function AuthEntry({ signedIn, onNavigate }: { signedIn: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (signedIn) {
    return (
      <div className="flex items-center gap-5">
        <Link to="/home" onClick={onNavigate} className="hover:text-ink-950">
          Dashboard
        </Link>
        <button
          type="button"
          onClick={async () => {
            onNavigate?.();
            await queryClient.cancelQueries();
            queryClient.clear();
            await supabase.auth.signOut();
            navigate({ to: "/", replace: true });
          }}
          className="min-w-0 py-1 text-left hover:text-ink-950"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/auth"
      search={{ mode: "sign-in" }}
      onClick={onNavigate}
      className="min-w-0 py-1 hover:text-ink-950"
    >
      Sign in
    </Link>
  );
}
