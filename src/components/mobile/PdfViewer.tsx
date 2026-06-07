import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

export default function PdfViewer({
  url,
  label,
  storagePath: _storagePath,
}: {
  url: string;
  label?: string;
  storagePath?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setSlowLoad(false);
    const timer = window.setTimeout(() => setSlowLoad(true), 4500);
    return () => window.clearTimeout(timer);
  }, [url, reloadKey]);

  const viewerUrl = useMemo(() => {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }, [url]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!loaded && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center"
            style={{ backgroundColor: "var(--eyeframe-bg)" }}
          >
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
              style={{ color: "var(--eyeframe-accent)" }}
            />
            <div className="text-sm opacity-80">Loading presentation…</div>
            {slowLoad && (
              <div className="flex max-w-md flex-col items-center gap-3 px-6">
                <div className="text-xs opacity-60">
                  If the PDF viewer does not appear, open it directly.
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
        <iframe
          key={reloadKey}
          src={viewerUrl}
          title={label ?? "PDF presentation"}
          className="h-full w-full"
          style={{ border: 0, display: "block", backgroundColor: "var(--eyeframe-bg)" }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
