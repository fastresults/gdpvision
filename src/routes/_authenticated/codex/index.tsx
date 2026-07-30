import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { scrollToTop } from "@/lib/utils";
import { CODEX_ENTRIES } from "@/lib/codex-entries";

export const Route = createFileRoute("/_authenticated/codex/")({
  head: () => ({
    meta: [
      { title: "The Codex — GDPVision" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Methodology handbook: how every number in the instrument is derived, graded, and cited.",
      },
    ],
  }),
  component: CodexPage,
});

const ENTRIES = CODEX_ENTRIES;

function CodexPage() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument" onClick={() => scrollToTop()}>
            <Wordmark />
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            The Codex
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/instrument" className="hover:text-ink-950">
            Instrument
          </Link>
          <Link to="/narrative" className="hover:text-ink-950">
            Narrative
          </Link>
          <Link to="/config" className="hover:text-ink-950">
            Configuration
          </Link>
          <button onClick={signOut} className="hover:text-ink-950">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-[220px_1fr] gap-16 px-8 py-16">
        <nav className="sticky top-16 h-fit space-y-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {ENTRIES.map((e) => (
            <a key={e.id} href={`#${e.id}`} className="block hover:text-ink-950">
              {e.title}
            </a>
          ))}
        </nav>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Methodology handbook
          </p>
          <h1 className="mt-2 font-serif text-4xl">The Codex</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-500">
            The instrument's methodology in one place. Every drill-down from a headline number in
            the Ledger, Scenario Engine, or Counsel resolves here. Reviewed annually by an
            independent economist (Phase 5).
          </p>

          <div className="mt-12 space-y-12">
            {ENTRIES.map((e) => (
              <section key={e.id} id={e.id} className="border-t border-line-200 pt-8">
                <h2 className="font-serif text-2xl">{e.title}</h2>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-700">{e.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
