import { useEffect, useMemo, useRef, useState } from "react";
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
  const [status, setStatus] = useState("Loading PDF…");
  const pagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = pagesRef.current;
    if (!host) return;

    let cancelled = false;
    let loadingTask: { promise: Promise<any>; destroy: () => Promise<void> } | null = null;
    let pdfDoc: { numPages: number; getPage: (pageNumber: number) => Promise<any>; destroy: () => Promise<void> } | null = null;
    const renderTasks: Array<{ promise: Promise<void>; cancel: () => void }> = [];

    setErrored(false);
    setStatus("Loading PDF…");
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
          shell.style.margin = "0 auto 16px";
          shell.style.width = `${viewport.width}px`;
          shell.style.maxWidth = "100%";
          shell.style.background = "var(--eyeframe-surface, #111827)";
          shell.style.border = "1px solid var(--eyeframe-border, rgba(255,255,255,0.12))";
          shell.style.boxShadow = "0 18px 40px rgba(0,0,0,0.28)";

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
    };
  }, [pdfUrl, reloadKey]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
    >
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div ref={pagesRef} className="mx-auto min-h-full w-full px-3 py-4" />

        {status && !errored && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-md px-3 py-2 text-sm shadow-lg" style={{ backgroundColor: "var(--eyeframe-surface)", border: "1px solid var(--eyeframe-border)" }}>
            {status}
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
