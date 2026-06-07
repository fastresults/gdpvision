import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

async function renderFirstPagePng(file: File): Promise<Blob | null> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const targetW = 1200;
    const scale = targetW / viewport.width;
    const v = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = v.width;
    canvas.height = v.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport: v, canvas }).promise;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
  } catch {
    return null;
  }
}

export default function PresentationUpload({ onUploaded }: { onUploaded: () => void }) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("PDF exceeds 50 MB limit.");
      return;
    }
    setFile(f);
    if (!label) setLabel(f.name.replace(/\.pdf$/i, ""));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    pickFile(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const submit = async () => {
    if (!file || !label.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const thumb = await renderFirstPagePng(file);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", label.trim());
      if (thumb) fd.append("thumbnail", thumb, "thumb.png");
      const res = await fetch("/api/upload-presentation", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(body.error || "Upload failed");
      }
      setFile(null);
      setLabel("");
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="mb-8 rounded-lg border p-4"
      style={{
        backgroundColor: "var(--eyeframe-topbar)",
        borderColor: "var(--eyeframe-border)",
      }}
    >
      <div className="mb-3 text-sm font-medium opacity-80">Add a PDF Presentation</div>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="mb-3 w-full rounded-md border px-3 py-2 text-sm outline-none"
        style={{
          backgroundColor: "var(--eyeframe-card)",
          borderColor: "var(--eyeframe-border)",
          color: "var(--eyeframe-text)",
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors"
        style={{
          borderColor: dragOver ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
          backgroundColor: dragOver
            ? "color-mix(in oklch, var(--eyeframe-accent) 10%, transparent)"
            : "var(--eyeframe-card)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6" style={{ color: "var(--eyeframe-accent)" }} />
            <div className="text-sm">
              <div className="font-medium">{file.name}</div>
              <div className="text-xs opacity-60">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="ml-2 rounded-full p-1 opacity-60 hover:opacity-100"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-7 w-7 opacity-60" />
            <div className="text-sm font-medium">Drop a PDF here, or click to browse</div>
            <div className="text-xs opacity-50">PDF only · up to 50 MB</div>
          </>
        )}
      </div>

      {error && <div className="mt-3 text-xs text-red-400">{error}</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!file || !label.trim() || uploading}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : "Upload presentation"}
      </button>
    </div>
  );
}
