import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The framed live panel in the briefing: one chrome for every embedded page,
 * whether a chamber inside gdpvision.com or a summit site. Address strip,
 * open-in-tab, reset, and full-width controls sit in the same place on every
 * step. Shows a quiet loading plate until the page reports it has loaded.
 */

const MICRO = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500";

export interface LiveFrameProps {
  /** Absolute URL or a same-origin path. */
  src: string;
  /** What appears in the address strip. */
  label: string;
  title: string;
  /** Mount the iframe only once the step is in view. */
  active: boolean;
  wide: boolean;
  onWide: () => void;
  onNarrow: () => void;
  className?: string;
}

export function LiveFrame({
  src,
  label,
  title,
  active,
  wide,
  onWide,
  onNarrow,
  className,
}: LiveFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [gen, setGen] = useState(0);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-line-200 bg-paper-0 shadow-[0_24px_60px_-30px_rgba(8,17,31,0.35)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-200 bg-paper-50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              loaded ? "bg-signal-positive" : "bg-line-200",
            )}
            aria-hidden
          />
          <span className={cn(MICRO, "truncate")}>{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setLoaded(false);
              setGen((g) => g + 1);
            }}
            aria-label="Reload this page"
            title="Reload"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          {wide ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={onNarrow}
              aria-label="Back to the step"
              title="Back to the step"
            >
              <Minimize2 className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={onWide}
              aria-label="Tour it full width"
              title="Full width"
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
          )}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            aria-label="Open in a new tab"
            title="Open in a new tab"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
      <div className={cn("relative w-full bg-paper-100", wide ? "h-[82dvh]" : "aspect-[16/10]")}>
        {active ? (
          <iframe
            key={gen}
            title={title}
            src={src}
            className={cn(
              "absolute inset-0 h-full w-full transition-opacity duration-500",
              loaded ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allow="fullscreen; clipboard-read; clipboard-write"
            onLoad={() => setLoaded(true)}
          />
        ) : null}
        {!loaded ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <div
              className="prs-frame-sheen absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-paper-0/80 to-transparent"
              aria-hidden
            />
            <div className={cn(MICRO, "relative")}>Loading {label}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
