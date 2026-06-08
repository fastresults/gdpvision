import { useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

type Props = {
  url: string;
  label?: string;
  storagePath?: string | null;
};

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

  // Use the browser's native PDF viewer via <object>, with an iframe fallback
  // and an "Open PDF" link as a last resort. This was the approach that worked
  // most reliably on real devices in earlier iterations.
  const src = `${pdfUrl}#toolbar=1&navpanes=0&view=FitH`;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <object
          key={`${src}-${reloadKey}`}
          data={src}
          type="application/pdf"
          className="h-full w-full"
          onError={() => setErrored(true)}
        >
          <iframe
            src={src}
            title={label ?? "Presentation"}
            className="h-full w-full"
            style={{ border: 0, display: "block" }}
            onError={() => setErrored(true)}
          />
        </object>

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
