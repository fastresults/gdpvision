import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Maximize2,
  RefreshCw,
} from "lucide-react";
// Bundle the worker locally via Vite so it matches the installed pdfjs build
// and is served from the same origin (no unpkg CDN, no CORS surprises).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

export default function PdfViewer({ url, label }: { url: string; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [baseWidth, setBaseWidth] = useState<number | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Measure synchronously before paint so the first <Page> render already has
  // the correct width. This prevents the width-change render race that drops
  // mid-decode image XObjects (the "Dependent image isn't ready yet" warning
  // that blanks raster images on the canvas).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.clientWidth - 24); // account for padding
      if (next <= 0) return;
      // Only commit when the integer width actually changes — suppresses
      // sub-pixel ResizeObserver thrash that would cancel in-flight renders.
      setBaseWidth((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset when the document changes
  useEffect(() => {
    setPage(1);
    setZoom(1);
    setError(null);
  }, [url, reloadKey]);

  // Scroll to top when page changes
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(
    () => setPage((p) => Math.min(numPages || 1, p + 1)),
    [numPages],
  );
  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))),
    [],
  );
  const fitWidth = useCallback(() => setZoom(1), []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-" || e.key === "_") zoomOut();
      else if (e.key === "0") fitWidth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, zoomIn, zoomOut, fitWidth]);

  const documentOptions = useMemo(
    () => ({
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    }),
    [],
  );

  const renderWidth = baseWidth ? baseWidth * zoom : undefined;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-3"
      >
        {error ? (
          <div className="m-auto flex max-w-md flex-col items-center gap-3 text-center">
            <div className="text-sm opacity-80">
              Couldn't load {label ?? "this presentation"}.
            </div>
            <div className="text-xs opacity-60">{error}</div>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--eyeframe-border)" }}
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : (
          <Document
            key={reloadKey}
            file={url}
            options={documentOptions}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setError(null);
            }}
            onLoadError={(e) => {
              console.error("[PdfViewer] load error", e);
              setError(e?.message || "Failed to load PDF");
            }}
            onSourceError={(e) => {
              console.error("[PdfViewer] source error", e);
              setError(e?.message || "Failed to fetch PDF");
            }}
            loading={
              <div className="m-auto flex flex-col items-center gap-3 opacity-80">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
                  style={{ color: "var(--eyeframe-accent)" }}
                />
                <div className="text-sm">Loading presentation…</div>
              </div>
            }
            error={
              <div className="m-auto text-sm opacity-80">Failed to load PDF.</div>
            }
          >
            {baseWidth !== undefined && (
              <Page
                pageNumber={page}
                width={renderWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={
                  <div className="m-auto p-8 opacity-60 text-sm">Rendering page…</div>
                }
              />
            )}
          </Document>
        )}
      </div>

      {numPages > 0 && !error && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2"
          style={{
            backgroundColor: "var(--eyeframe-topbar)",
            borderColor: "var(--eyeframe-border)",
            paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
          }}
        >
          {/* Page nav */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={page <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30 active:bg-white/10"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-[70px] text-center text-sm tabular-nums">
              {page} / {numPages}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={page >= numPages}
              className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30 active:bg-white/10"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30 active:bg-white/10"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fitWidth}
              className="min-w-[56px] rounded-md px-2 py-1 text-xs tabular-nums active:bg-white/10"
              aria-label="Fit width"
              title="Fit width"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30 active:bg-white/10"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fitWidth}
              className="ml-1 hidden h-9 w-9 items-center justify-center rounded-full active:bg-white/10 sm:flex"
              aria-label="Fit to width"
              title="Fit to width"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
