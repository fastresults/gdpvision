import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, RefreshCw } from "lucide-react";
import { pdfjs } from "react-pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type Props = {
  url: string;
  label?: string;
  storagePath?: string | null;
};

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;

export default function PdfViewer({ url, label, storagePath }: Props) {
  const pdfUrl = useMemo(
    () =>
      storagePath
        ? `/api/public/presentation-pdf?path=${encodeURIComponent(storagePath)}`
        : url,
    [storagePath, url],
  );

  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNumPages(0);

    const loadingTask = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
    loadingTask.promise
      .then((pdf) => {
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[PdfViewer] failed to load PDF", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => {});
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      if (doc) doc.destroy().catch?.(() => {});
    };
  }, [pdfUrl, reloadKey]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {(loading || error) && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center"
            style={{ backgroundColor: "var(--eyeframe-bg)" }}
          >
            {!error && (
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
                style={{ color: "var(--eyeframe-accent)" }}
              />
            )}
            <div className="text-sm opacity-80">
              {error
                ? `Couldn't load ${label ?? "this presentation"}.`
                : "Loading presentation…"}
            </div>
            {error && (
              <div className="flex max-w-md flex-col items-center gap-3 px-6">
                <div className="text-xs opacity-60">{error}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--eyeframe-border)" }}
                  >
                    <RefreshCw className="h-4 w-4" /> Retry
                  </button>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
                    style={{
                      backgroundColor: "var(--eyeframe-accent)",
                      color: "var(--eyeframe-bg)",
                    }}
                  >
                    <ExternalLink className="h-4 w-4" /> Open PDF
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          ref={containerRef}
          className="h-full w-full overflow-auto"
          style={{ backgroundColor: "var(--eyeframe-bg)" }}
        >
          {!loading && !error && numPages > 0 && (
            <div className="mx-auto flex flex-col items-center gap-4 py-4">
              {Array.from({ length: numPages }, (_, i) => (
                <PdfPage
                  key={`${pdfUrl}-${reloadKey}-p${i + 1}`}
                  pdfDocRef={pdfDocRef}
                  pageNumber={i + 1}
                  zoom={zoom}
                />
              ))}
            </div>
          )}
        </div>

        {!loading && !error && numPages > 0 && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <button
              type="button"
              onClick={() => setZoom((v) => Math.max(MIN_ZOOM, v - ZOOM_STEP))}
              className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur"
              style={{
                backgroundColor: "var(--eyeframe-topbar)",
                borderColor: "var(--eyeframe-border)",
              }}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((v) => Math.min(MAX_ZOOM, v + ZOOM_STEP))}
              className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur"
              style={{
                backgroundColor: "var(--eyeframe-topbar)",
                borderColor: "var(--eyeframe-border)",
              }}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({
  pdfDocRef,
  pageNumber,
  zoom,
}: {
  pdfDocRef: React.MutableRefObject<Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | null>;
  pageNumber: number;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pdf = pdfDocRef.current;
    if (!pdf) return;

    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = Math.min(1400, window.innerWidth - 64) * (zoom / 100);
        const cssScale = targetWidth / baseViewport.width;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const renderScale = cssScale * dpr;
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        setDims({
          w: Math.floor(baseViewport.width * cssScale),
          h: Math.floor(baseViewport.height * cssScale),
        });

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          background: "#ffffff",
        }).promise;
      } catch (err) {
        if (cancelled) return;
        console.error(`[PdfViewer] failed to render page ${pageNumber}`, err);
        setPageError("Failed to render page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDocRef, pageNumber, zoom]);

  return (
    <div
      className="relative overflow-hidden rounded-sm shadow-lg"
      style={{
        width: dims ? `${dims.w}px` : undefined,
        height: dims ? `${dims.h}px` : undefined,
        backgroundColor: "#ffffff",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {pageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
          {pageError} (page {pageNumber})
        </div>
      )}
    </div>
  );
}
