// Photos and documents for one investment project: a gallery with a
// full-size viewer, a document list with an in-page PDF viewer, and an
// upload form for admins.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteProjectMedia,
  listProjectMedia,
  uploadProjectMedia,
  type ProjectMedia,
} from "@/lib/investments/media.functions";

import { ErrorText, errMessage, inputCls, MicroLabel } from "./ui";

async function toBase64(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function ProjectMediaPanel({
  code,
  projectId,
  canEdit,
}: {
  code: string;
  projectId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listProjectMedia);
  const upload = useServerFn(uploadProjectMedia);
  const remove = useServerFn(deleteProjectMedia);
  const key = ["project-media", code, projectId];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { code, projectId } }) });
  const [open, setOpen] = useState<ProjectMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const images = (q.data ?? []).filter((m) => m.kind === "image");
  const docs = (q.data ?? []).filter((m) => m.kind === "document");

  async function onUpload() {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setErr("Files must be 10 MB or smaller.");
    setBusy(true);
    setErr(null);
    try {
      await upload({
        data: {
          code,
          projectId,
          title: title.trim() || file.name,
          fileName: file.name,
          mime: file.type || "application/octet-stream",
          base64: await toBase64(file),
        },
      });
      setTitle("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(m: ProjectMedia) {
    if (!confirm(`Remove “${m.title}”?`)) return;
    try {
      await remove({ data: { id: m.id } });
      setOpen(null);
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setErr(errMessage(e));
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <MicroLabel>Photos</MicroLabel>
        {q.isLoading ? (
          <p className="mt-2 text-sm text-ink-500">Loading…</p>
        ) : images.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No photos yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpen(m)}
                className={
                  m.is_cover
                    ? "group text-left sm:col-span-2 lg:col-span-3"
                    : "group text-left"
                }
              >
                <div className="overflow-hidden border border-line-200 bg-paper-50">
                  {m.url && (
                    <img
                      src={m.url}
                      alt={m.title}
                      loading="lazy"
                      width={1536}
                      height={1024}
                      className="aspect-[3/2] w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  )}
                </div>
                <div className="mt-1.5 text-sm text-ink-950">
                  {m.title}
                  {m.is_cover && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      Cover
                    </span>
                  )}
                </div>
                {m.caption && <div className="text-xs text-ink-500">{m.caption}</div>}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <MicroLabel>Documents</MicroLabel>
        {docs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No documents yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-100 border-y border-line-100">
            {docs.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm text-ink-950">{m.title}</div>
                  <div className="text-xs text-ink-500">PDF{m.caption ? ` · ${m.caption}` : ""}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpen(m)}>
                    View
                  </button>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">
                      Download
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section className="max-w-xl">
          <MicroLabel>Add a photo or PDF</MicroLabel>
          <div className="mt-3 grid gap-2">
            <input
              className={inputCls}
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-ink-700"
            />
            <div>
              <button
                type="button"
                className="btn-primary px-3 py-2 text-xs"
                disabled={!file || busy}
                onClick={onUpload}
              >
                {busy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </section>
      )}
      {err && <ErrorText>{err}</ErrorText>}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>{open?.caption ?? ""}</DialogDescription>
          </DialogHeader>
          {open?.url &&
            (open.kind === "image" ? (
              <img src={open.url} alt={open.title} className="max-h-[75vh] w-full object-contain" />
            ) : (
              <iframe src={open.url} title={open.title} className="h-[75vh] w-full border border-line-200" />
            ))}
          {canEdit && open && (
            <div>
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onDelete(open)}>
                Remove
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
