import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Minus, Plus, RefreshCw } from "lucide-react";

export default function PdfViewer({
  url,
  label,
  storagePath,
}: {
  url: string;
  label?: string;
  storagePath?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const pdfUrl = useMemo(
    () => storagePath ? `/api/presentation-pdf?path=${encodeURIComponent(storagePath)}` : url,
    [storagePath, url],
  );
  const viewerUrl = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`;

  useEffect(() => {
    setLoaded(false);
    setError(null);
  }, [pdfUrl]);

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
            {error && (
              <div className="flex max-w-md flex-col items-center gap-3 px-6">
                <div className="text-xs opacity-60">
                  {error}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoaded(false);
                      setError(null);
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
        )}
        <iframe
          key={`${pdfUrl}-${reloadKey}`}
          src={viewerUrl}
          title={label ?? "Presentation PDF"}
          className="absolute inset-0 h-full w-full"
          style={{ border: 0, backgroundColor: "var(--eyeframe-bg)" }}
          onLoad={() => {
            setLoaded(true);
            setError(null);
          }}
          onError={() => setError("The embedded PDF viewer could not load this file.")}
        />
        {loaded && !error && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 25))} className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur" style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }} aria-label="Zoom out">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setZoom((value) => Math.min(300, value + 25))} className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur" style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }} aria-label="Zoom in">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
