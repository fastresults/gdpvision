// Concierge invitation card — replaces the previous full-width black slab.
// Framed correspondence: paper-0 body, gold hairline top rule, ink pill CTA.

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function ConciergeInvitationCard() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12">
      <div className="relative col-span-1 border border-line-200 bg-card p-8 shadow-sm lg:col-span-8">
        {/* gold + ink hairline seal */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gold-500" />
        <div className="absolute inset-x-0 top-[3px] h-px bg-ink-950" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
              The Concierge · By invitation
            </p>
            <h2 className="mt-4 font-serif text-3xl leading-tight text-ink-950">
              <span className="italic">Would you rather</span>{" "}
              have our office handle it?
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500">
              Send a written request in your own words — voice, note, or paste.
              Our team will do the work and bring it back to you, organised by lane,
              with every source stamped and dated.
            </p>
          </div>

          <Link
            to="/concierge"
            className="group inline-flex items-center gap-2 self-start bg-ink-950 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-0 transition hover:bg-gold-500 hover:text-ink-950"
          >
            Open the Concierge
            <ArrowRight size={14} strokeWidth={1.5} className="transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
