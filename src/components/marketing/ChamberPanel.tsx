import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChamberPanelProps {
  index: string; // "01" .. "10"
  title: string;
  /** Command-length outcome shown beneath the header image. */
  outcome: string;
  purpose: string;
  bullets: string[];
  /** CSS variable name for horizontal accents and screenshot outline, e.g. "--sector-03". */
  accentVar: string;
  /** Optional CDN URL for a real product screenshot rendered as the panel header. */
  image?: string;
  /** Curated 16:9 capture of the chamber's strongest product view. */
  screenshot?: string;
  valueEstimate?: ReactNode;
  children?: ReactNode;
  className?: string;
}

// Paper panel: open side edges and subtle horizontal hairline separators.
// Chamber colour remains in small horizontal accents, never a full-height rail.
export function ChamberPanel({
  index,
  title,
  outcome,
  purpose,
  bullets,
  accentVar,
  screenshot,
  valueEstimate,
  className,
}: ChamberPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const finePointer = useRef(false);

  // The zoom follows the cursor only on a mouse-like pointer; on touch the
  // image simply scales from its centre.
  useEffect(() => {
    finePointer.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
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
      <div className="pl-5 pr-4 py-5 sm:pl-6 sm:pr-5 sm:py-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <span className="flex items-start gap-3 pt-1">
            {/* 4px vertical rule spanning the full height of the chamber label. */}
            <span
              aria-hidden
              className="w-1 flex-none self-stretch"
              style={{ background: `var(${accentVar})` }}
            />
            <span
              className="font-serif text-[26px] leading-none tracking-tight text-ink-950 sm:text-[32px]"
              style={{ color: `var(${accentVar})` }}
            >
              Chamber {index}
            </span>
          </span>
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

        {valueEstimate}

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
