import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The framed live panel in the briefing: one chrome for every embedded page,
 * whether a chamber inside gdpvision.com or a summit site. Address strip,
 * open-in-tab, reset, and full-width controls sit in the same place on every
 * step. Shows a quiet loading plate until the page reports it has loaded.
 */

const MICRO = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500";
const DESKTOP_CANVAS_WIDTH = 1280;

export interface LiveFrameProps {
  /** Absolute URL or a same-origin path. */
  src: string;
  /** What appears in the address strip. */
  label: string;
  title: string;
  wide: boolean;
  onWide: () => void;
  onNarrow: () => void;
  className?: string;
}

export function LiveFrame({
  src,
  label,
  title,
  wide,
  onWide,
  onNarrow,
  className,
}: LiveFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [gen, setGen] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "slow" | "signin">("loading");
  const retried = useRef(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Detect a finished page even if it finished before React was listening:
  // the early stamp from PresentDeck, the same-origin ready state, or a live
  // load event. A 45s watchdog reloads once, then reports "slow".
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let done = false;
    const settle = () => {
      let signin = false;
      try {
        const path = frame.contentWindow?.location.pathname;
        signin = !!path && path.startsWith("/auth");
      } catch {
        // cross-origin: cannot read, treat as loaded
      }
      done = true;
      setLoaded(true);
      setStatus(signin ? "signin" : "ready");
    };
    const check = () => {
      if (frame.hasAttribute("data-loaded")) return settle();
      try {
        const doc = frame.contentDocument;
        if (doc && doc.readyState === "complete" && doc.URL !== "about:blank") settle();
      } catch {
        /* cross-origin */
      }
    };
    check();
    frame.addEventListener("load", settle);
    // Same-origin apps change route after load (e.g. to sign-in); re-check.
    const poll = window.setInterval(() => done && settle(), 3000);
    const watchdog = window.setTimeout(() => {
      if (done) return;
      if (!retried.current) {
        retried.current = true;
        setGen((g) => g + 1);
      } else {
        setStatus("slow");
      }
    }, 45000);
    return () => {
      frame.removeEventListener("load", settle);
      window.clearInterval(poll);
      window.clearTimeout(watchdog);
    };
  }, [gen]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () => setViewportWidth(viewport.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const canvasWidth = Math.max(DESKTOP_CANVAS_WIDTH, viewportWidth);
  const scale = viewportWidth > 0 ? viewportWidth / canvasWidth : 1;

  return (
    <div
      data-live-frame
      data-state={status}
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-xl border border-line-200 bg-paper-0 shadow-[0_24px_60px_-30px_rgba(8,17,31,0.35)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-200 bg-paper-50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              status === "ready" ? "bg-signal-positive" : status === "loading" ? "bg-line-200" : "bg-gold-500" : "bg-line-200",
            )}
            aria-hidden
          />
          <span className={cn(MICRO, "truncate")}>
            {status === "signin"
              ? "Sign in to show live Chamber"
              : status === "slow"
                ? "Taking longer than usual — Reload"
                : label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setLoaded(false);
              setStatus("loading");
              retried.current = false;
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
              aria-label="Tour it larger"
              title="Larger"
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
      <div ref={viewportRef} className="relative aspect-[9/12] w-full overflow-hidden bg-paper-100">
        <iframe
          key={gen}
          ref={frameRef}
          title={title}
          src={src}
          className={cn(
            "absolute left-0 top-0 max-w-none origin-top-left transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
          style={{
            width: `${canvasWidth}px`,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
          }}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
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
