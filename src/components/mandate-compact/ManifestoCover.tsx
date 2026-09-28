// Chamber 08 · Manifesto cover.
//
// Every manifesto always shows a cover: the uploaded image, a first-page
// render of its PDF, or a typographic stand-in drawn from the ink/paper
// palette. Never blank.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";

import {
  getManifestoCovers,
  uploadManifestoThumbnail,
  type ManifestoCoverInfo,
} from "@/lib/mandate-compact/thumbnail.functions";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<ManifestoCoverInfo["source"], string> = {
  uploaded: "Uploaded",
  first_page: "From first page",
  placeholder: "Stand-in",
};

export function useManifestoCovers(ids: string[]) {
  const fn = useServerFn(getManifestoCovers);
  const key = [...ids].sort();
  return useQuery({
    queryKey: ["manifesto-covers", key],
    queryFn: () => fn({ data: { manifestoIds: key } }),
    enabled: key.length > 0,
    staleTime: 30 * 60 * 1000,
    select: (rows) => new Map(rows.map((r) => [r.manifestoId, r])),
  });
}

function initials(title: string | null | undefined): string {
  const t = (title ?? "").replace(/\.(pdf|docx?|txt|md)$/i, "");
  const tok = t.split(/[\s_\-–—]+/).filter(Boolean);
  const acronym = tok.find((w) => /^[A-Z]{2,6}$/.test(w));
  if (acronym) return acronym;
  return tok.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? "").join("") || "M";
}

export function ManifestoCover({
  info,
  fallbackTitle,
  fallbackYear,
  className,
  onOpen,
}: {
  info?: ManifestoCoverInfo;
  fallbackTitle?: string | null;
  fallbackYear?: string | null;
  className?: string;
  onOpen?: () => void;
}) {
  const title = info?.title ?? fallbackTitle ?? null;
  const year = (info?.electionCycle ?? fallbackYear ?? "").match(/\d{4}/)?.[0] ?? (title ?? "").match(/\d{4}/)?.[0] ?? "";
  const Wrapper = onOpen ? "button" : "span";
  return (
    <Wrapper
      {...(onOpen ? { type: "button" as const, onClick: onOpen, "aria-label": "View full cover" } : {})}
      className={cn(
        "relative block aspect-[3/4] shrink-0 overflow-hidden border border-line-200 bg-paper-50",
        className,
      )}
    >
      {info?.url ? (
        <img src={info.url} alt={title ? `Cover of ${title}` : "Manifesto cover"} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full w-full flex-col justify-between bg-ink-950 p-[10%] text-paper-0">
          <span className="font-mono text-[0.5em] uppercase tracking-[0.2em] opacity-70">Manifesto</span>
          <span className="font-serif text-[1.1em] leading-none">{initials(title)}</span>
          <span className="border-t border-gold-500 pt-[4%] font-mono text-[0.5em] tracking-[0.15em] text-gold-300">{year}</span>
        </span>
      )}
    </Wrapper>
  );
}

async function fileToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Render page 1 of a PDF to a PNG blob in the browser. */
export async function renderPdfFirstPage(file: Blob): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 900 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
  await pdf.destroy();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Render failed"))), "image/png"));
}

export function useUploadCover() {
  const fn = useServerFn(uploadManifestoThumbnail);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ manifestoId, blob, source }: { manifestoId: string; blob: Blob; source: "uploaded" | "first_page" }) => {
      const type = blob.type as "image/png" | "image/jpeg" | "image/webp";
      if (!["image/png", "image/jpeg", "image/webp"].includes(type)) throw new Error("Use a JPG, PNG or WebP image.");
      return fn({ data: { manifestoId, contentType: type, base64: await fileToBase64(blob), source } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifesto-covers"] }),
  });
}

/** Cover + source label + admin controls for one manifesto. */
export function ManifestoCoverPanel({ manifestoId, info, title }: { manifestoId: string; info?: ManifestoCoverInfo; title?: string | null }) {
  const upload = useUploadCover();
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const run = (blob: Blob, source: "uploaded" | "first_page") =>
    upload.mutate(
      { manifestoId, blob, source },
      { onSuccess: () => toast.success("Cover saved"), onError: (e) => toast.error((e as Error).message) },
    );

  return (
    <div className="flex items-start gap-4">
      <ManifestoCover info={info} fallbackTitle={title} className="w-24 text-[18px]" onOpen={info?.url ? () => setOpen(true) : undefined} />
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Cover · {SOURCE_LABEL[info?.source ?? "placeholder"]}
        </p>
        {(info?.source ?? "placeholder") === "placeholder" && (
          <p className="max-w-xs text-[12px] text-ink-700">This manifesto is showing a stand-in. Add the real cover.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={upload.isPending} onClick={() => imgRef.current?.click()}>
            {upload.isPending ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />} Replace cover
          </button>
          <button type="button" className="btn-ghost" disabled={upload.isPending} onClick={() => pdfRef.current?.click()}>
            Use first page of PDF
          </button>
        </div>
        <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f, "uploaded"); e.target.value = ""; }} />
        <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          try { run(await renderPdfFirstPage(f), "first_page"); } catch (err) { toast.error(`Couldn't read the PDF: ${(err as Error).message}`); }
        }} />
      </div>
      {open && info?.url && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-6" onClick={() => setOpen(false)}>
          <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={info.url} alt={title ? `Cover of ${title}` : "Manifesto cover"} className="max-h-[85vh] w-auto border border-line-200" />
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="btn-secondary absolute right-2 top-2"><X size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
