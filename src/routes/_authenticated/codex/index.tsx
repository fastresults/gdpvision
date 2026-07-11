import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/codex/")({
  head: () => ({
    meta: [
      { title: "The Codex — GDPVision" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Methodology handbook: how every number in the instrument is derived, graded, and cited." },
    ],
  }),
  component: CodexPage,
});

const ENTRIES = [
  {
    id: "confidence",
    title: "Confidence grading (A/B/C/D)",
    body:
      "Every stored figure carries a grade. A: government-published, current-fiscal. B: government-published, prior-fiscal or partial. C: multilateral (IMF/World Bank/ECCB) or reputable third-party. D: analyst reconstruction. Grades pair with pattern in the design system (§13.4) so hue is never load-bearing.",
  },
  {
    id: "sector-composition",
    title: "Sector composition (Ledger)",
    body:
      "Shares reconcile to 100% at the national level. Where a national account line spans two GDPVision sectors, the split is disclosed in the country_pack methodology block and is auditable in Stewardship.",
  },
  {
    id: "cbi-index",
    title: "CBI Exposure Index",
    body:
      "The index reads on a 0–100 scale, where 100 = full dependency of consolidated fiscal revenue on CBI receipts. Components: (a) CBI as share of recurrent revenue, (b) CBI as share of capital budget financing, (c) sensitivity to a 20% wind-down. Methodology drill-down is available on the Exposure screen.",
  },
  {
    id: "ripple",
    title: "Scenario ripple propagation",
    body:
      "First-order impact is direct-sector. Second-order impact runs through the dependency web (fixed-coefficient in v1.0, reviewed annually by the external economist). Third-order impact is fiscal (revenue elasticity table by sector). Ranges, never points.",
  },
  {
    id: "target-anchoring",
    title: "Evidence-anchored target setting (Mandate)",
    body:
      "Every KPI target must reference a baseline, a peer benchmark, or a scenario projection. Targets that exceed the best of the three by more than 30% are flagged as over-claim and require an override note. Classifications: Committed, Stretch, Aspirational (FR-KP-02).",
  },
  {
    id: "second-brain",
    title: "The Second Brain (Narrative Memory)",
    body:
      "Memory objects are typed: audience, position, statement, outlet, precedent. Every object is scoped (country silo vs. regional commons), sector-keyed, and weighted 1–5. Suppressed sources are removed from both retrieval and citation; suppression state is auditable.",
  },
  {
    id: "release-doctrine",
    title: "Comms release doctrine",
    body:
      "Drafts progress draft → advisor_review → comms_review → cabinet_review → released. Artifacts containing fiscal figures gate at comms_review pending a Ledger sign-off note. No autonomous release, ever (Principle 7).",
  },
  {
    id: "counsel-doctrine",
    title: "Counsel doctrine",
    body:
      "2–4 sentence answers, ranked alternatives named where relevant, every claim cited to a Ledger figure or Second-Brain object. Confidence grade is spoken when it is C or D. Save-to-archive captures the exact scenario snapshot the answer was given under.",
  },
] as const;

function CodexPage() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">The Codex</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/instrument" className="hover:text-ink-950">Instrument</Link>
          <Link to="/narrative" className="hover:text-ink-950">Narrative</Link>
          <Link to="/config" className="hover:text-ink-950">Configuration</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-[220px_1fr] gap-16 px-8 py-16">
        <nav className="sticky top-16 h-fit space-y-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {ENTRIES.map((e) => (
            <a key={e.id} href={`#${e.id}`} className="block hover:text-ink-950">{e.title}</a>
          ))}
        </nav>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Methodology handbook</p>
          <h1 className="mt-2 font-serif text-4xl">The Codex</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-500">
            The instrument's methodology in one place. Every drill-down from a headline number in the Ledger, Scenario Engine, or
            Counsel resolves here. Reviewed annually by an independent economist (Phase 5).
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
