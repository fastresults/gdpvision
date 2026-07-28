import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { AttentionItem } from "@/lib/executive/attention";

/**
 * The verdict rail. The first thing on screen is prose, ranked, each item a
 * sentence a human would say out loud — not a wall of widgets that leaves the
 * diagnosis to the reader. Hover reveals why an item ranked where it did.
 */
export function AttentionRail({ code, items }: { code: string; items: AttentionItem[] }) {
  return (
    <section className="border-y border-ink-950">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line-200 px-5 py-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">Requires you</h2>
        <span data-numeric className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "nothing outstanding"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-[15px] text-ink-500">
          Nothing requires the Principal this morning. Every chamber is inside tolerance.
        </p>
      ) : (
        <ul>
          {items.map((it, i) => (
            <li key={`${it.chamber}-${i}`} style={{ animationDelay: `${i * 40}ms` }} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:fill-mode-both">
              <Link
                to={it.to}
                params={{ code }}
                className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-line-100 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <span data-numeric className="shrink-0 font-mono text-[10px] tracking-[0.2em] text-ink-500">
                  {it.chamber}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15.5px] leading-snug text-ink-950">{it.text}</span>
                  <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300 transition-colors group-hover:text-ink-500">
                    {it.chamberTitle} · {it.because.join(" · ")}
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-950"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
