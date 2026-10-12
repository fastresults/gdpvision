// "Our Journey" — a slowly drifting photo row on the homepage. Admins can add,
// remove, reorder and caption photos in place. Reads are public (RLS); every
// write is admin-only, enforced by row-level security and storage policies.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Photo = {
  id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  alt: string;
  sort_order: number;
};

const KEY = ["site-gallery"];
const MICRO = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500";

async function fetchPhotos(): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("site_gallery_images")
    .select("id,storage_path,url,caption,alt,sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function useIsAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: ok } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      if (live) setAdmin(!!ok);
    });
    return () => {
      live = false;
    };
  }, []);
  return admin;
}

export function SiteGallery({ variant = "home" }: { variant?: "home" | "present" }) {
  const present = variant === "present";
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery({ queryKey: KEY, queryFn: fetchPhotos });
  const admin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    try {
      let order = (photos.at(-1)?.sort_order ?? 0) + 10;
      for (const f of files) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error(`${f.name}: use JPG, PNG or WebP.`);
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB.`);
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("site-gallery").upload(path, f, { contentType: f.type });
        if (up.error) throw up.error;
        const signed = await supabase.storage
          .from("site-gallery")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (signed.error || !signed.data) throw signed.error ?? new Error("Could not link the photo");
        const ins = await supabase.from("site_gallery_images").insert({
          storage_path: path,
          url: signed.data.signedUrl,
          alt: f.name.replace(/\.[^.]+$/, ""),
          sort_order: order,
        });
        if (ins.error) throw ins.error;
        order += 10;
      }
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Photo) {
    const { error } = await supabase.from("site_gallery_images").delete().eq("id", p.id);
    if (error) return setErr(error.message);
    if (!p.storage_path.startsWith("asset:")) {
      await supabase.storage.from("site-gallery").remove([p.storage_path]);
    }
    refresh();
  }

  async function move(i: number, dir: -1 | 1) {
    const a = photos[i];
    const b = photos[i + dir];
    if (!a || !b) return;
    await supabase.from("site_gallery_images").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("site_gallery_images").update({ sort_order: a.sort_order }).eq("id", b.id);
    refresh();
  }

  async function caption(p: Photo, value: string) {
    if ((p.caption ?? "") === value) return;
    await supabase.from("site_gallery_images").update({ caption: value || null }).eq("id", p.id);
    refresh();
  }

  async function altText(p: Photo, value: string) {
    if (!value || p.alt === value) return;
    await supabase.from("site_gallery_images").update({ alt: value }).eq("id", p.id);
    refresh();
  }

  async function reorder(ids: string[]) {
    await Promise.all(
      ids.map((id, i) => supabase.from("site_gallery_images").update({ sort_order: (i + 1) * 10 }).eq("id", id)),
    );
    refresh();
  }

  const nudge = (dir: -1 | 1) => {
    setPaused(true);
    trackRef.current?.parentElement?.scrollBy({ left: dir * 420, behavior: "smooth" });
  };

  const moving = !editing && !paused && !hoverPaused && photos.length > 0;

  return (
    <section
      id={present ? "journey-gallery" : "journey"}
      className={present ? "w-full min-w-0" : "border-b border-line-200 py-16"}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6">
        <div>
          <div className={MICRO}>Our Journey</div>
          <h2
            className={cn(
              "mt-3 font-display leading-tight text-ink-950",
              present ? "text-[clamp(2.4rem,4.5vw,4rem)]" : "text-[clamp(1.8rem,3vw,2.6rem)]",
            )}
          >
            Where the work has taken us
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {admin ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing(true)}
            >
              Edit gallery
            </button>
          ) : null}
          <button type="button" className="btn-ghost" aria-label="Previous photos" onClick={() => nudge(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost" aria-label="Next photos" onClick={() => nudge(1)}>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {err && !editing ? <p className="mx-auto mt-3 max-w-7xl px-6 text-sm text-signal-negative">{err}</p> : null}

      <div
        className="mt-8 overflow-x-auto journey-scroll"
        onClick={() => setPaused((v) => !v)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHoverPaused(true);
        }}
        onPointerLeave={() => setHoverPaused(false)}
        data-held={paused || hoverPaused || undefined}
      >
        <div
          ref={trackRef}
          className={cn("flex w-max gap-4 px-6", photos.length > 0 && "journey-track")}
          style={{ animationPlayState: moving ? "running" : "paused" }}
        >
          {[...photos, ...photos].map((p, i) => (
            <figure
              key={`${p.id}-${i}`}
              className={cn("relative shrink-0", present ? "w-[min(82vw,560px)]" : "w-[min(78vw,420px)]")}
              aria-hidden={i >= photos.length ? true : undefined}
            >
              <button
                type="button"
                className="block w-full overflow-hidden rounded-lg border border-line-200 bg-paper-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(p);
                }}
              >
                <img
                  src={p.url}
                  alt={p.alt}
                  loading="lazy"
                  width={840}
                  height={560}
                  className="aspect-[3/2] w-full object-cover"
                />
              </button>
              {p.caption ? <figcaption className="mt-2 text-sm text-ink-700">{p.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>

      <GalleryManager
        open={editing}
        onOpenChange={setEditing}
        photos={photos}
        busy={busy}
        err={err}
        onFiles={addFiles}
        onRemove={remove}
        onMove={move}
        onCaption={caption}
        onAlt={altText}
        onReorder={reorder}
      />

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-5xl">
          <DialogTitle className="sr-only">{open?.alt ?? "Photo"}</DialogTitle>
          <DialogDescription className="sr-only">{open?.caption ?? "Our Journey photograph"}</DialogDescription>
          {open ? (
            <>
              <img src={open.url} alt={open.alt} className="max-h-[78vh] w-full object-contain" />
              {open.caption ? <p className="text-sm text-ink-700">{open.caption}</p> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

type ManagerProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  photos: Photo[];
  busy: boolean;
  err: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (p: Photo) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onCaption: (p: Photo, v: string) => void;
  onAlt: (p: Photo, v: string) => void;
  onReorder: (ids: string[]) => void;
};

/** Admin-only manager: drop zone + a numbered list where each row shows the exact photo it edits. */
function GalleryManager({ open, onOpenChange, photos, busy, err, onFiles, onRemove, onMove, onCaption, onAlt, onReorder }: ManagerProps) {
  const [list, setList] = useState(photos);
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => {
    if (!dragId) setList(photos);
  }, [photos, dragId]);
  const over = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setList((cur) => {
      const from = cur.findIndex((x) => x.id === dragId);
      const to = cur.findIndex((x) => x.id === targetId);
      if (from < 0 || to < 0) return cur;
      const next = [...cur];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };
  const drop = () => {
    if (!dragId) return;
    setDragId(null);
    if (list.some((p, i) => p.id !== photos[i]?.id)) onReorder(list.map((p) => p.id));
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  };
  const field = "w-full rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-950";

  return (
    <Dialog open={open} onOpenChange={(o) => { setConfirmId(null); onOpenChange(o); }}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-4 overflow-hidden">
        <div>
          <DialogTitle className="font-display text-2xl text-ink-950">Manage Our Journey</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-700">
            Add photos by dropping them below. Each numbered row is one photo, in the order visitors see them. Drag a photo by its picture to move it up or down. Changes save automatically.
          </DialogDescription>
        </div>

        <label
          onDragOver={(e) => { if (dragId) return; e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { if (dragId) return; e.preventDefault(); setDrag(false); if (!busy) take(e.dataTransfer.files); }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            drag ? "border-gold-500 bg-paper-100" : "border-line-200 bg-paper-50",
            busy && "cursor-wait opacity-70",
          )}
        >
          <ImagePlus className="h-7 w-7 text-ink-700" />
          <span className="text-sm font-medium text-ink-950">
            {busy ? "Uploading…" : drag ? "Drop to add these photos" : "Drag photos here, or click to choose"}
          </span>
          <span className={MICRO}>JPG, PNG or WebP · up to 10 MB each · added to the end</span>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => take(e.target.files)} />
        </label>
        {err ? <p className="text-sm text-signal-negative">{err}</p> : null}

        <div className={MICRO}>{photos.length} photos</div>
        <ol className="-mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {list.map((p, i) => (
            <li
              key={p.id}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                over(p.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop();
              }}
              className={cn("flex gap-4 rounded-lg border p-3 transition-shadow", dragId === p.id && "opacity-50 shadow-lg", confirmId === p.id ? "border-signal-negative bg-paper-100" : "border-line-200 bg-paper-0")}>
              <div className="flex w-8 shrink-0 flex-col items-center gap-1">
                <span className="font-mono text-sm text-ink-950">{i + 1}</span>
                <button type="button" className="btn-ghost" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => onMove(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" className="btn-ghost" aria-label={`Move photo ${i + 1} later`} disabled={i === list.length - 1} onClick={() => onMove(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", p.id);
                  setDragId(p.id);
                }}
                onDragEnd={drop}
                title="Drag to reorder"
                className="relative shrink-0 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="absolute left-1 top-1 h-5 w-5 rounded bg-paper-0 text-ink-700" />
              <img src={p.url} alt={p.alt} draggable={false} className="aspect-[3/2] w-40 shrink-0 rounded border border-line-200 object-cover sm:w-52" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <label className="block">
                  <span className={MICRO}>Caption shown to visitors</span>
                  <input key={`c-${p.id}-${p.caption}`} defaultValue={p.caption ?? ""} placeholder="Optional" onBlur={(e) => onCaption(p, e.target.value.trim())} className={cn(field, "mt-1")} />
                </label>
                <label className="block">
                  <span className={MICRO}>Description for screen readers</span>
                  <input key={`a-${p.id}-${p.alt}`} defaultValue={p.alt} onBlur={(e) => onAlt(p, e.target.value.trim())} className={cn(field, "mt-1")} />
                </label>
                {confirmId === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink-950">Remove photo {i + 1}? This can’t be undone.</span>
                    <button type="button" className="btn-primary" onClick={() => { setConfirmId(null); onRemove(p); }}>Yes, remove</button>
                    <button type="button" className="btn-ghost" onClick={() => setConfirmId(null)}>Keep</button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" onClick={() => setConfirmId(p.id)}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remove this photo
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={() => onOpenChange(false)}>Done</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
