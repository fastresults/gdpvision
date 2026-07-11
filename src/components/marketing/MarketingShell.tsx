import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wordmark } from "./Wordmark";
import { supabase } from "@/integrations/supabase/client";

interface MarketingShellProps {
  children: ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-paper-0 text-ink-950 font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-950 focus:px-3 focus:py-2 focus:text-paper-0 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.16em]"
      >
        Skip to content
      </a>
      <header className="border-b border-line-200">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 md:px-10">
          <a href="#top" className="focus-visible:outline-none">
            <Wordmark className="text-[15px] md:text-[17px]" />
          </a>
          <nav className="flex items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            <a href="#instrument" className="hover:text-ink-950">The Instrument</a>
            <a href="#sovereignty" className="hover:text-ink-950">Sovereignty</a>
            <a href="#briefing" className="hover:text-ink-950 text-ink-950">
              Request briefing
            </a>
            <InstrumentEntry />
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-line-200 mt-24 bg-paper-0">
        <div className="mx-auto max-w-[1280px] px-6 py-10 md:px-10">
          <div className="grid gap-10 md:grid-cols-[1fr_auto] items-end">
            <div>
              <Wordmark className="text-[13px]" />
              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-ink-700">
                An OPEN Interactive product. Sovereign instances of the GDPVision
                instrument are provisioned by invitation, under a confidential
                engagement with the government of the day.
              </p>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 flex flex-wrap gap-6">
              <span>OPEN Interactive · 2009–2026</span>
              <span>Confidential — government briefing use</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InstrumentEntry() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
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
  if (signedIn === null) return null;
  return signedIn ? (
    <Link to="/instrument" className="hover:text-ink-950">Open instrument</Link>
  ) : (
    <Link to="/auth" className="hover:text-ink-950">Sign in</Link>
  );
}
