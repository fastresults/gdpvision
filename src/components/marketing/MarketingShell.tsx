import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { supabase } from "@/integrations/supabase/client";

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

const SECTION_LINKS = [
  { hash: "instrument", label: "The Instrument" },
  { hash: "sovereignty", label: "Sovereignty" },
] as const;

export function MarketingShell({ children }: MarketingShellProps) {
  const signedIn = useSignedIn();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950 font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-950 focus:px-3 focus:py-2 focus:text-paper-0 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.16em]"
      >
        Skip to content
      </a>
      <header className="border-b border-line-200">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 md:px-10">
          <Link to={signedIn ? "/home" : "/"} className="focus-visible:outline-none">
            <Wordmark className="text-[15px] md:text-[17px]" />
          </Link>

          <nav className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 md:flex md:gap-8">
            {SECTION_LINKS.map((s) => (
              <Link key={s.hash} to="/" hash={s.hash} className="hover:text-ink-950">
                {s.label}
              </Link>
            ))}
            <Link to="/business-case" className="hover:text-ink-950">
              The business case
            </Link>
            <Link to="/op-eds" className="hover:text-ink-950">
              The writing
            </Link>
            <Link
              to="/"
              hash="briefing"
              className="hover:text-ink-950 text-ink-950 border-l-2 border-gold-500 pl-3"
            >
              Request briefing
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
              {SECTION_LINKS.map((s) => (
                <Link
                  key={s.hash}
                  to="/"
                  hash={s.hash}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-line-100 py-3 hover:text-ink-950"
                >
                  {s.label}
                </Link>
              ))}
              <Link
                to="/business-case"
                onClick={() => setMenuOpen(false)}
                className="border-b border-line-100 py-3 hover:text-ink-950"
              >
                The business case
              </Link>
              <Link
                to="/op-eds"
                onClick={() => setMenuOpen(false)}
                className="border-b border-line-100 py-3 hover:text-ink-950"
              >
                The writing
              </Link>
              <Link
                to="/"
                hash="briefing"
                onClick={() => setMenuOpen(false)}
                className="border-b border-line-100 py-3 text-ink-950 hover:text-ink-950"
              >
                Request briefing
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
              <Wordmark className="text-[13px]" />
              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-ink-700">
                An OPEN Interactive product. Sovereign instances of the GDPVision instrument are
                provisioned by invitation, under a confidential engagement with the government of
                the day.
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
          className="hover:text-ink-950"
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
      className="hover:text-ink-950"
    >
      Sign in
    </Link>
  );
}
