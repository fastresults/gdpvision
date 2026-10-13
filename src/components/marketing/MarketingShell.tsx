import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { scrollToTop } from "@/lib/utils";

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

const DETAILS_KEY = "gdpv.navDetails";

function useDetailsUnlocked() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(DETAILS_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(DETAILS_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, ready]);
  return [open, setOpen] as const;
}

type NavLink = { to: string; hash?: string; lines: string[] };

// Every nav label of two or more words renders as two fixed lines so the top
// navigation keeps a consistent two-row rhythm; single-word labels stay one line.
const PRIMARY_LINK: NavLink = { to: "/", hash: "instrument", lines: ["How", "it works"] };

const DETAIL_LINKS: NavLink[] = [
  { to: "/", hash: "sovereignty", lines: ["Sovereignty"] },
  { to: "/vault", lines: ["The", "Vault"] },
  { to: "/record", lines: ["The National", "Record"] },
  { to: "/business-case", lines: ["The business", "case"] },
  { to: "/business-case/brief", lines: ["The Decision", "Brief"] },
  { to: "/op-eds", lines: ["The", "writing"] },
];

function NavItem({ link }: { link: NavLink }) {
  return (
    <Link to={link.to} hash={link.hash} className="min-w-0 py-1 hover:text-ink-950">
      {link.lines.map((line) => (
        <span key={line} className="block whitespace-nowrap">
          {line}
        </span>
      ))}
    </Link>
  );
}

export function MarketingShell({ children }: MarketingShellProps) {
  const signedIn = useSignedIn();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useDetailsUnlocked();

  const toggle = (
    <button
      type="button"
      aria-expanded={detailsOpen}
      aria-controls="nav-details"
      onClick={() => setDetailsOpen((v) => !v)}
      className="btn-ghost shrink-0 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em]"
    >
      {detailsOpen ? (
        <span className="block text-left">
          <span className="block whitespace-nowrap text-left">Hide</span>
          <span className="block whitespace-nowrap text-left">Details</span>
        </span>
      ) : (
        "Click to enable details"
      )}
    </button>
  );

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper-0 text-ink-950 font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-950 focus:px-3 focus:py-2 focus:text-paper-0 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.16em]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line-200 bg-paper-0/95 backdrop-blur supports-[backdrop-filter]:bg-paper-0/80">
        <div className="flex items-center justify-between gap-6 px-4 py-2 md:py-3">
          <Link
            to="/"
            onClick={() => scrollToTop()}
            aria-label="GDPVision home"
            className="flex shrink-0 items-center focus-visible:outline-none"
          >
            <Wordmark className="h-[2.17rem] md:h-[2.89rem]" />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 md:flex">
            <NavItem link={PRIMARY_LINK} />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              {detailsOpen ? (
                <div
                  id="nav-details"
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 animate-in fade-in duration-300 motion-reduce:animate-none"
                >
                  {DETAIL_LINKS.map((l) => (
                    <NavItem key={l.to} link={l} />
                  ))}
                </div>
              ) : (
                <div id="nav-details" className="flex flex-1 items-center justify-center gap-4">
                  <span className="normal-case tracking-normal font-sans text-[13px] text-ink-700">
                    There’s more beneath the surface.
                  </span>
                </div>
              )}
              {toggle}
            </div>
            <Link
              to="/"
              hash="briefing"
              className="min-w-0 border-l-2 border-gold-500 py-1 pl-3 text-ink-950 hover:text-ink-950"
            >
              <span className="block whitespace-nowrap">Request a Cabinet</span>
              <span className="block whitespace-nowrap">briefing</span>
            </Link>
            <AuthEntry signedIn={signedIn} />
          </nav>

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

        {menuOpen && (
          <div className="border-t border-line-200 md:hidden">
            <nav className="mx-auto flex max-w-[1280px] flex-col px-6 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-700">
              <Link
                to="/"
                hash="instrument"
                onClick={() => setMenuOpen(false)}
                className="border-b border-line-100 py-3 hover:text-ink-950"
              >
                How it works
              </Link>
              <div className="flex items-center justify-between gap-3 border-b border-line-100 py-3">
                {!detailsOpen && (
                  <span className="normal-case tracking-normal font-sans text-[13px] text-ink-700">
                    There’s more beneath the surface.
                  </span>
                )}
                {toggle}
              </div>
              {detailsOpen &&
                DETAIL_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    hash={l.hash}
                    onClick={() => setMenuOpen(false)}
                    className="border-b border-line-100 py-3 pl-3 hover:text-ink-950"
                  >
                    {l.lines.join(" ")}
                  </Link>
                ))}
              <Link
                to="/"
                hash="briefing"
                onClick={() => setMenuOpen(false)}
                className="border-b border-line-100 py-3 text-ink-950 hover:text-ink-950"
              >
                Request a Cabinet briefing
              </Link>
              <div className="py-3">
                <AuthEntry signedIn={signedIn} onNavigate={() => setMenuOpen(false)} />
              </div>
            </nav>
          </div>
        )}
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-line-200 mt-24 bg-paper-0">
        <div className="mx-auto max-w-[1280px] px-6 py-10 md:px-10">
          <div className="grid gap-10 md:grid-cols-[1fr_auto] items-end">
            <div>
              <Wordmark className="h-8" />
              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-ink-700">
                A government-controlled decision system delivered by OPEN Interactive through a
                confidential engagement with the authorised government of the day.
              </p>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 flex flex-wrap gap-6">
              <Link to="/business-case" className="hover:text-ink-950">
                The business case
              </Link>
              <span>OPEN Interactive · 2009–2026</span>
              <span>Confidential — government briefing use</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
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
          <span className="block whitespace-nowrap">Sign</span>
          <span className="block whitespace-nowrap">out</span>
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
      <span className="block whitespace-nowrap">Sign</span>
      <span className="block whitespace-nowrap">in</span>
    </Link>
  );
}
