import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, RefreshCw } from "lucide-react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import { EventBus, PDFLinkService, PDFViewer as PdfJsViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer({
  url,
  label,
  storagePath,
}: {
  url: string;
  label?: string;
  storagePath?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<PdfJsViewer | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 4500);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  const pdfUrl = useMemo(
    () => storagePath ? `/api/presentation-pdf?path=${encodeURIComponent(storagePath)}` : url,
    [storagePath, url],
  );

  useEffect(() => {
    const container = containerRef.current;
    const viewer = viewerRef.current;
    if (!container || !viewer) return;

    let cancelled = false;
    setLoaded(false);
    setSlowLoad(false);
    setError(null);
    viewer.replaceChildren();
    pdfViewerRef.current = null;
    pdfDocRef.current = null;

    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const pdfViewer = new PdfJsViewer({
      container,
      viewer,
      eventBus,
      linkService,
      removePageBorders: true,
      textLayerMode: 0,
      annotationMode: 0,
    });
    linkService.setViewer(pdfViewer);
    pdfViewerRef.current = pdfViewer;
    eventBus.on("pagesinit", () => {
      pdfViewer.currentScaleValue = "page-width";
      setLoaded(true);
    });

    const task = getDocument({ url: pdfUrl });
    task.promise
      .then((pdf) => {
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfDocRef.current = pdf;
        pdfViewer.setDocument(pdf);
        linkService.setDocument(pdf, null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PDF");
      });

    return () => {
      cancelled = true;
      task.destroy();
      pdfDocRef.current?.destroy();
    };
  }, [pdfUrl, reloadKey]);

  const zoom = (delta: number) => {
    const viewer = pdfViewerRef.current;
    if (!viewer) return;
    const current = typeof viewer.currentScale === "number" ? viewer.currentScale : 1;
    viewer.currentScale = Math.max(0.5, Math.min(3, current + delta));
  };

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {(!loaded || error) && (
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
              {error ? `Couldn't load ${label ?? "this presentation"}.` : "Loading presentation…"}
            </div>
            {(slowLoad || error) && (
              <div className="flex max-w-md flex-col items-center gap-3 px-6">
                <div className="text-xs opacity-60">
                  {error ?? "If the PDF viewer does not appear, open it directly."}
                </div>
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
                    href={url}
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
        <div ref={containerRef} className="absolute inset-0 overflow-auto" style={{ backgroundColor: "oklch(0.16 0 0)" }}>
          <div ref={viewerRef} className="pdfViewer" />
        </div>
        {loaded && !error && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <button type="button" onClick={() => zoom(-0.15)} className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur" style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }} aria-label="Zoom out">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => zoom(0.15)} className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur" style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }} aria-label="Zoom in">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
