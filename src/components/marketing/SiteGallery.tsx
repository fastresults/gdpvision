// "Our Journey" — a slowly drifting photo row on the homepage. Admins can add,
// remove, reorder and caption photos in place. Reads are public (RLS); every
// write is admin-only, enforced by row-level security and storage policies.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, X } from "lucide-react";
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

export function SiteGallery() {
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery({ queryKey: KEY, queryFn: fetchPhotos });
  const admin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      let order = (photos.at(-1)?.sort_order ?? 0) + 10;
      for (const f of Array.from(files)) {
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
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(p: Photo) {
    if (!confirm("Remove this photo from Our Journey?")) return;
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

  const nudge = (dir: -1 | 1) => {
    setPaused(true);
    trackRef.current?.parentElement?.scrollBy({ left: dir * 420, behavior: "smooth" });
  };

  const moving = !editing && !paused && photos.length > 0;

  return (
    <section id="journey" className="border-b border-line-200 py-16">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6">
        <div>
          <div className={MICRO}>Our Journey</div>
          <h2 className="mt-3 font-display text-[clamp(1.8rem,3vw,2.6rem)] leading-tight text-ink-950">
            Where the work has taken us
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {admin ? (
            <button
              type="button"
              className={editing ? "btn-primary" : "btn-secondary"}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Done editing" : "Edit gallery"}
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
      {err ? <p className="mx-auto mt-3 max-w-7xl px-6 text-sm text-signal-negative">{err}</p> : null}

      <div
        className={cn("mt-8 overflow-x-auto", !editing && "journey-scroll")}
        onClick={() => !editing && setPaused((v) => !v)}
        data-held={paused || undefined}
      >
        <div
          ref={trackRef}
          className={cn("flex w-max gap-4 px-6", moving && "journey-track")}
        >
          {(editing ? photos : [...photos, ...photos]).map((p, i) => {
            const idx = i % Math.max(photos.length, 1);
            return (
              <figure
                key={`${p.id}-${i}`}
                className="relative w-[min(78vw,420px)] shrink-0"
                aria-hidden={!editing && i >= photos.length ? true : undefined}
              >
                <button
                  type="button"
                  className="block w-full overflow-hidden rounded-lg border border-line-200 bg-paper-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!editing) setOpen(p);
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
                {editing ? (
                  <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      defaultValue={p.caption ?? ""}
                      placeholder="Caption (optional)"
                      onBlur={(e) => caption(p, e.target.value.trim())}
                      className="w-full rounded border border-line-200 bg-paper-0 px-2 py-1 text-sm text-ink-950"
                    />
                    <div className="flex gap-1">
                      <button type="button" className="btn-ghost" aria-label="Move earlier" disabled={idx === 0} onClick={() => move(idx, -1)}>
                        <ArrowUp className="h-4 w-4 -rotate-90" />
                      </button>
                      <button type="button" className="btn-ghost" aria-label="Move later" disabled={idx === photos.length - 1} onClick={() => move(idx, 1)}>
                        <ArrowDown className="h-4 w-4 -rotate-90" />
                      </button>
                      <button type="button" className="btn-secondary ml-auto" onClick={() => remove(p)}>
                        <X className="mr-1 h-4 w-4" /> Remove
                      </button>
                    </div>
                  </div>
                ) : p.caption ? (
                  <figcaption className="mt-2 text-sm text-ink-700">{p.caption}</figcaption>
                ) : null}
              </figure>
            );
          })}
          {editing ? (
            <label className="flex aspect-[3/2] w-[min(78vw,420px)] shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-200 bg-paper-50 text-ink-700">
              <Plus className="h-6 w-6" />
              <span className={MICRO}>{busy ? "Uploading…" : "Add photos"}</span>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          ) : null}
        </div>
      </div>

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
