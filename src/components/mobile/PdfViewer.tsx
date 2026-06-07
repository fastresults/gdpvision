import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Load worker from CDN matched to the bundled pdfjs version.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full w-full flex-col" style={{ backgroundColor: "#111" }}>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-3"
      >
        {error ? (
          <div className="m-auto text-center text-sm opacity-80" style={{ color: "white" }}>
            {error}
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setError(null);
            }}
            onLoadError={(e) => setError(e?.message || "Failed to load PDF")}
            loading={
              <div className="m-auto text-sm opacity-70" style={{ color: "white" }}>
                Loading PDF…
              </div>
            }
          >
            <Page
              pageNumber={page}
              width={width}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>
        )}
      </div>
      {numPages > 0 && (
        <div
          className="flex shrink-0 items-center justify-center gap-4 border-t px-4 py-3"
          style={{
            backgroundColor: "var(--eyeframe-topbar)",
            borderColor: "var(--eyeframe-border)",
            color: "var(--eyeframe-text)",
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30 active:bg-white/10"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[80px] text-center text-sm tabular-nums">
            {page} / {numPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30 active:bg-white/10"
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
