import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Wordmark } from "./Wordmark";
import { supabase } from "@/integrations/supabase/client";

interface MarketingShellProps {
  children: ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
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
          <a href="#top" className="focus-visible:outline-none">
            <Wordmark className="text-[15px] md:text-[17px]" />
          </a>
          <nav className="flex items-center gap-6 md:gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            <a href="#instrument" className="hover:text-ink-950 hidden md:inline">The Instrument</a>
            <a href="#sovereignty" className="hover:text-ink-950 hidden md:inline">Sovereignty</a>
            <a href="#briefing" className="hover:text-ink-950 text-ink-950 hidden md:inline">
              Request briefing
            </a>
            <AuthEntry />
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

function AuthEntry() {
  // Optimistic default: show logged-out affordances until we know otherwise,
  // so the header never renders empty on first paint.
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const navigate = useNavigate();

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

  if (signedIn) {
    return (
      <div className="flex items-center gap-5">
        <Link to="/instrument" className="hover:text-ink-950">Open instrument</Link>
        <button
          type="button"
          onClick={async () => {
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
    <div className="flex items-center gap-4 md:gap-5">
      <Link to="/auth" search={{ mode: "sign-in" }} className="hover:text-ink-950">
        Sign in
      </Link>
      <Link
        to="/auth"
        search={{ mode: "sign-up" }}
        className="border-l-2 border-gold-500 bg-ink-950 px-3 py-2 text-paper-0 hover:bg-ink-700"
      >
        Create account
      </Link>
      <Link
        to="/auth"
        search={{ mode: "forgot" }}
        className="hover:text-ink-950 hidden md:inline"
      >
        Forgot?
      </Link>
    </div>
  );
}
