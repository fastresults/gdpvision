import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MOMENT_VARIANTS } from "@/lib/moment-variants";
import { useScrollerIntroduction } from "@/hooks/useScrollerIntroduction";
import { Illustration } from "./Illustration";
import { SectionHeader } from "./SectionHeader";
import { NumberTile } from "./NumberTile";

export function ExposureCarousel() {
  const { ref, cancel } = useScrollerIntroduction<HTMLDivElement>();
  const [index, setIndex] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      current.current = Math.round(el.scrollLeft / el.clientWidth);
      setIndex(current.current);
    };
    el.addEventListener("scroll", update, { passive: true });
    let previousWidth = el.clientWidth;
    const resize = new ResizeObserver(() => {
      if (previousWidth === el.clientWidth) return;
      cancel();
      previousWidth = el.clientWidth;
      el.scrollLeft = current.current * el.clientWidth;
    });
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [ref, cancel]);
  const page = (direction: number) => {
    cancel();
    const el = ref.current;
    if (!el) return;
    const next =
      (Math.round(el.scrollLeft / el.clientWidth) + direction + MOMENT_VARIANTS.length) %
      MOMENT_VARIANTS.length;
    el.scrollTo({
      left: next * el.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => page(-1)}
          aria-label="Previous exposure"
          className="btn-primary mt-32 h-11 w-11 !rounded-full !p-0 sm:mt-36 sm:h-14 sm:w-14"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div
          ref={ref}
          tabIndex={0}
          aria-label="Regional exposures"
          className="relative flex min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
        >
          {MOMENT_VARIANTS.map((moment, i) => (
            <div
              key={moment.id}
              inert={i !== index}
              aria-hidden={i !== index}
              className="w-full min-w-0 shrink-0 snap-start"
            >
              <div className="grid min-w-0 items-center gap-6 md:grid-cols-[320px_minmax(0,1fr)] md:gap-10 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-12">
                <Illustration
                  src={moment.illustration}
                  alt={moment.title}
                  variant="spot"
                  className="mx-auto !w-[200px] sm:!w-[232px] md:mx-0 md:!w-[320px] lg:!w-[384px]"
                />
                <SectionHeader
                  eyebrow="The moment · Eight regional exposures, graded and cited"
                  title={moment.title}
                  lede={moment.lede}
                />
              </div>
              <div className="mt-10 grid gap-10 border-t border-line-200 pt-10 sm:mt-16 sm:gap-12 sm:pt-12 md:grid-cols-3">
                {moment.stats.map((s, n) => (
                  <NumberTile key={n} {...s} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => page(1)}
          aria-label="Next exposure"
          className="btn-primary mt-32 h-11 w-11 !rounded-full !p-0 sm:mt-36 sm:h-14 sm:w-14"
        >
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p className="mt-12 max-w-2xl text-[15px] leading-relaxed text-ink-700">
        Every figure carries a source and a confidence grade. Grade A means an official or directly
        verified source; lower grades show where further checking is needed. GDPVision applies the
        same standard to figures prepared for Cabinet.
      </p>
      <nav
        aria-label="Position in the regional exposures"
        className="mt-10 flex justify-end border-t border-line-200 pt-4 sm:mt-16 sm:pt-6"
      >
        <span className="font-mono text-[11px] tabular-nums text-ink-950">
          {String(index + 1).padStart(2, "0")}
          <span className="mx-2 text-ink-300">/</span>
          {String(MOMENT_VARIANTS.length).padStart(2, "0")}
        </span>
      </nav>
    </>
  );
}
