import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import "pdfjs-viewer-element";

type Props = {
  url: string;
  label?: string;
  storagePath?: string | null;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "pdfjs-viewer-element": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          viewer?: string;
          "iframe-title"?: string;
          page?: string | number;
          zoom?: string;
          pagemode?: string;
        },
        HTMLElement
      >;
    }
  }
}

export default function PdfViewer({ url, label, storagePath }: Props) {
  const pdfUrl = useMemo(
    () =>
      storagePath
        ? `/api/public/presentation-pdf?path=${encodeURIComponent(storagePath)}`
        : url,
    [storagePath, url],
  );

  const [reloadKey, setReloadKey] = useState(0);
  const [errored, setErrored] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setErrored(false);
    const el = elRef.current as
      | (HTMLElement & { initPromise?: Promise<unknown> })
      | null;
    if (!el) return;
    let cancelled = false;
    const t = setTimeout(() => {
      // If the viewer never resolves init within 15s, surface fallback.
      if (!cancelled && !el.initPromise) setErrored(true);
    }, 15000);
    el.initPromise
      ?.then(() => {
        clearTimeout(t);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pdfUrl, reloadKey]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <pdfjs-viewer-element
          key={`${pdfUrl}-${reloadKey}`}
          ref={(node: HTMLElement | null) => {
            elRef.current = node;
          }}
          src={pdfUrl}
          iframe-title={label ?? "Presentation"}
          zoom="page-width"
          style={{ display: "block", width: "100%", height: "100%" }}
        />

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
