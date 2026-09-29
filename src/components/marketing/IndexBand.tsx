// The measures investors read first: a row of ten measuring bodies under the
// home page hero, each with the indexes it publishes and the GDPVision chamber
// that works on them. Visitor-controlled scrolling (scroll snap + buttons),
// never an auto-marquee. Names in type; no third-party logos without written
// permission (see src/lib/marketing/global-indexes.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MEASURING_BODIES } from "@/lib/marketing/global-indexes";

export function IndexBand() {
  const rowRef = useRef<HTMLUListElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    update();
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section id="measures" aria-labelledby="measures-title" className="border-b border-line-200">
      <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-6 sm:py-14 md:px-10 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              The measures investors read first
            </div>
            <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
            <h2
              id="measures-title"
              className="mt-5 font-serif text-[24px] leading-[1.2] tracking-tight text-ink-950 md:text-[30px]"
            >
              Ten bodies set the standard measures that rank a country for investors and lenders.
              GDPVision tracks them and shows which decisions move them.
            </h2>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              className="btn-ghost h-10 w-10 p-0"
              onClick={() => page(-1)}
              disabled={edge.start}
              aria-label="Previous measures"
            >
              <ChevronLeft className="mx-auto h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-ghost h-10 w-10 p-0"
              onClick={() => page(1)}
              disabled={edge.end}
              aria-label="Next measures"
            >
              <ChevronRight className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative mt-8">
          <ul
            ref={rowRef}
            tabIndex={0}
            aria-label="Measuring bodies and their indexes"
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500 [scrollbar-width:thin]"
          >
            {MEASURING_BODIES.map((b) => (
              <li
                key={b.key}
                className="flex w-[78%] shrink-0 snap-start flex-col border border-line-200 border-t-2 border-t-gold-500 bg-paper-0 sm:w-[280px]"
              >
                <div className="px-5 pt-5">
                  {b.logo ? (
                    <img src={b.logo} alt="" className="h-8 w-auto" loading="lazy" />
                  ) : (
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">
                      {b.short}
                    </div>
                  )}
                  <h3 className="mt-2 font-serif text-[19px] leading-snug text-ink-950">
                    {b.name}
                  </h3>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                    {b.area}
                  </div>
                </div>
                <ul className="mx-5 mt-4 flex-1 space-y-2 border-t border-line-100 pt-4">
                  {b.indexes.map((i) => (
                    <li key={i.name} className="text-[14px] leading-snug">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                      >
                        {i.name}
                      </a>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400">
                        {i.edition}
                      </span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/#instrument"
                  className="mx-5 mt-5 border-t border-line-100 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 hover:text-ink-950"
                >
                  In GDPVision: {b.chambers}
                </a>
              </li>
            ))}
          </ul>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-paper-0 to-transparent transition-opacity ${edge.end ? "opacity-0" : "opacity-100"}`}
          />
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-ink-500">
          Indexes are published independently by the bodies named. GDPVision is not affiliated with
          or endorsed by them.
        </p>
      </div>
    </section>
  );
}
