import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Printer, RefreshCw } from "lucide-react";

type Props = {
  url: string;
  label?: string;
  storagePath?: string | null;
  showToolbar?: boolean;
};

export default function PdfViewer({ url, label, storagePath, showToolbar = false }: Props) {
  const pdfUrl = useMemo(
    () =>
      storagePath
        ? `/api/public/presentation-pdf?path=${encodeURIComponent(storagePath)}`
        : url,
    [storagePath, url],
  );

  const [reloadKey, setReloadKey] = useState(0);
  const [errored, setErrored] = useState(false);
  const [status, setStatus] = useState("Loading PDF…");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageEls = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const host = pagesRef.current;
    if (!host) return;

    let cancelled = false;
    let loadingTask: { promise: Promise<any>; destroy: () => Promise<void> } | null = null;
    let pdfDoc: { numPages: number; getPage: (pageNumber: number) => Promise<any>; destroy: () => Promise<void> } | null = null;
    const renderTasks: Array<{ promise: Promise<void>; cancel: () => void }> = [];

    setErrored(false);
    setStatus("Loading PDF…");
    setNumPages(0);
    setCurrentPage(1);
    pageEls.current = [];
    host.replaceChildren();

    const renderPdf = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(pdfUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buffer),
          disableAutoFetch: true,
          disableStream: true,
          useSystemFonts: true,
        }) as { promise: Promise<any>; destroy: () => Promise<void> };

        const pdf = await loadingTask.promise;
        pdfDoc = pdf;
        setNumPages(pdf.numPages);
        const width = Math.max(host.clientWidth - 24, 320);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          setStatus(`Rendering slide ${pageNumber} of ${pdf.numPages}…`);

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const cssScale = width / baseViewport.width;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: cssScale });

          const shell = document.createElement("div");
          shell.dataset.page = String(pageNumber);
          shell.style.margin = "0 auto 16px";
          shell.style.width = `${viewport.width}px`;
          shell.style.maxWidth = "100%";
          shell.style.background = "var(--eyeframe-surface, #111827)";
          shell.style.border = "1px solid var(--eyeframe-border, rgba(255,255,255,0.12))";
          shell.style.boxShadow = "0 18px 40px rgba(0,0,0,0.28)";
          shell.style.scrollMarginTop = "8px";

          const canvas = document.createElement("canvas");
          canvas.setAttribute("aria-label", `${label ?? "Presentation"} slide ${pageNumber}`);
          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.display = "block";
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.style.maxWidth = "100%";
          shell.append(canvas);
          host.append(shell);
          pageEls.current[pageNumber - 1] = shell;

          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas is unavailable");
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

          const renderTask = page.render({ canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
          page.cleanup();
        }

        if (!cancelled) setStatus("");
      } catch (error) {
        if (cancelled) return;
        console.error("PDF render failed", error);
        setErrored(true);
        setStatus("Couldn't load PDF.");
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel());
      void loadingTask?.destroy();
      void pdfDoc?.destroy();
      host.replaceChildren();
      pageEls.current = [];
    };
  }, [pdfUrl, reloadKey, label]);

  // Track which page is most visible while scrolling
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || numPages === 0) return;
    const els = pageEls.current.filter(Boolean);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (!page) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { page, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) setCurrentPage(best.page);
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, reloadKey]);

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, page));
    const el = pageEls.current[clamped - 1];
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      setCurrentPage(clamped);
    }
  }, [numPages]);

  const goPrev = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const goNext = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const fileName = useMemo(() => {
    const base = (label ?? "presentation").replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "");
    return `${base || "presentation"}.pdf`;
  }, [label]);

  const atStart = currentPage <= 1;
  const atEnd = numPages === 0 || currentPage >= numPages;

  return (
      {showToolbar && (
      <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-surface)" }}
      >
        <div className="truncate text-sm font-medium opacity-90">{label ?? "Presentation"}</div>
        <div className="flex items-center gap-1">
          <div
            className="mr-1 flex items-center gap-1 rounded-md border px-1 py-0.5"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={atStart}
              title="Previous page"
              aria-label="Previous page"
              className="inline-flex items-center rounded p-1 text-xs disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] text-center text-xs tabular-nums">
              {numPages ? `${currentPage} / ${numPages}` : "–"}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={atEnd}
              title="Next page"
              aria-label="Next page"
              className="inline-flex items-center rounded p-1 text-xs disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Reload"
            aria-label="Reload PDF"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            aria-label="Open PDF in new tab"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => {
              const w = window.open(pdfUrl, "_blank");
              if (w) {
                w.addEventListener("load", () => {
                  try { w.print(); } catch { /* ignore */ }
                });
              }
            }}
            title="Print"
            aria-label="Print PDF"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <Printer className="h-4 w-4" />
          </button>
          <a
            href={pdfUrl}
            download={fileName}
            title="Download"
            aria-label="Download PDF"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div ref={pagesRef} className="mx-auto min-h-full w-full px-3 py-4" />

        {status && !errored && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-md px-3 py-2 text-sm shadow-lg" style={{ backgroundColor: "var(--eyeframe-surface)", border: "1px solid var(--eyeframe-border)" }}>
            {status}
          </div>
        )}

        {numPages > 1 && !errored && !status && (
          <div
            className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border px-2 py-1 shadow-lg backdrop-blur"
            style={{ backgroundColor: "var(--eyeframe-surface)", borderColor: "var(--eyeframe-border)" }}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={atStart}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] text-center text-xs tabular-nums">
              {currentPage} / {numPages}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={atEnd}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {errored && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center"
            style={{ backgroundColor: "var(--eyeframe-bg)" }}
          >
            <div className="text-sm opacity-80">
              Couldn't load {label ?? "this presentation"}.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setErrored(false);
                  setReloadKey((k) => k + 1);
                }}
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
    </div>
  );
}
