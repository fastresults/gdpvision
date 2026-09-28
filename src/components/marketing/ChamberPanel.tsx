import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Illustration } from "./Illustration";


interface ChamberPanelProps {
  index: string; // "01" .. "10"
  title: string;
  /** Command-length outcome shown beneath the header image. */
  outcome: string;
  purpose: string;
  bullets: string[];
  /** CSS variable name for the leading accent bar hue, e.g. "--sector-03". */
  accentVar: string;
  /** Optional CDN URL for a real product screenshot rendered as the panel header. */
  image?: string;
  /** Curated 16:9 capture of the chamber's strongest product view. */
  screenshot?: string;
  children?: ReactNode;
  className?: string;
}

// Paper panel: borderless white body, hairline separators, 2px leading
// sector-hue accent bar (PRD §10.5). No filled header, no reverse-out.
export function ChamberPanel({
  index,
  title,
  outcome,
  purpose,
  bullets,
  accentVar,
  image,
  screenshot,
  className,
}: ChamberPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const finePointer = useRef(false);

  // The zoom follows the cursor only on a mouse-like pointer; on touch the
  // image simply scales from its centre.
  useEffect(() => {
    finePointer.current = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!finePointer.current) return;
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden bg-paper-0 min-h-[240px]",
        "border-t border-b border-line-200",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 z-10 h-full w-[2px]"
        style={{ background: `var(${accentVar})` }}
      />
      <div className="pl-5 pr-4 py-5 sm:pl-6 sm:pr-5 sm:py-6">
        <div className="flex items-start justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500 sm:gap-4">
          <span className="pt-1">Chamber {index}</span>
          {image ? (
            <Illustration
              src={image}
              variant="mark"
              className="shrink-0 !w-[104px] sm:!w-[130px] md:!w-[160px]"
            />
          ) : null}
        </div>

        {screenshot ? (
          <div
            ref={frameRef}
            onPointerMove={handlePointerMove}
            className="group/media relative mt-5 aspect-video w-full overflow-hidden rounded-md border border-line-200 bg-paper-50 shadow-sm"
          >
            <img
              ref={imgRef}
              src={screenshot}
              alt={`${title} product view`}
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
              draggable={false}
              className={cn(
                "h-full w-full origin-center object-cover will-change-transform",
                "transition-transform duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                "group-hover/media:scale-[1.07]",
                "motion-reduce:transition-none motion-reduce:group-hover/media:scale-100",
              )}
            />
            {/* Chamber-hue hairline appears with the zoom, tying the image to its identity. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-500 group-hover/media:opacity-100 motion-reduce:transition-none"
              style={{ boxShadow: `inset 0 0 0 1px var(${accentVar})` }}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <span
            aria-hidden
            className="block h-[2px] w-8"
            style={{ background: `var(${accentVar})` }}
          />
          <p className="mt-3.5 font-serif text-[19px] leading-snug text-ink-950 sm:text-[21px]">
            {outcome}
          </p>
        </div>

        <h3 className="mt-4 font-serif text-[23px] leading-tight text-ink-950 sm:text-[27px]">
          {title}
        </h3>

        <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{purpose}</p>
        <ul className="mt-5 space-y-2.5 text-[13.5px] leading-relaxed text-ink-700">
          {bullets.map((b) => (
            <li key={b} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2 inline-block h-[1px] w-4 flex-none"
                style={{ background: `var(${accentVar})` }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
