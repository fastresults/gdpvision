import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Film, Image as ImageIcon, Library, Plus, Trash2, Upload } from "lucide-react";
import {
  listGalleries,
  listAllGalleryItems,
  createGallery,
  updateGallery,
  deleteGallery,
  moveGallery,
  addGalleryItem,
  deleteGalleryItem,
  moveGalleryItem,
  updateGalleryItem,
} from "@/lib/galleries.functions";
import { uploadEventVideo } from "@/lib/items.functions";
import { uploadMedia, listMedia, type MediaAsset } from "@/lib/media.functions";
import type { Category, Gallery, GalleryItem, MediaMode } from "@/lib/kiosk-types";

export default function GalleryManager({ category }: { category: Category }) {
  const qc = useQueryClient();
  const fetchGalleries = useServerFn(listGalleries);
  const fetchItems = useServerFn(listAllGalleryItems);
  const createGalleryFn = useServerFn(createGallery);
  const updateGalleryFn = useServerFn(updateGallery);
  const moveGalleryFn = useServerFn(moveGallery);
  const deleteGalleryFn = useServerFn(deleteGallery);

  const { data: galleries = [] } = useQuery<Gallery[]>({
    queryKey: ["galleries", category.id],
    queryFn: () => fetchGalleries({ data: { categoryId: category.id } }),
  });
  const { data: allItems = [] } = useQuery<GalleryItem[]>({
    queryKey: ["gallery_items"],
    queryFn: () => fetchItems(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["galleries", category.id] });
    qc.invalidateQueries({ queryKey: ["gallery_items"] });
  };

  const [newLabel, setNewLabel] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const createMut = useMutation({
    mutationFn: () => createGalleryFn({ data: { categoryId: category.id, label: newLabel.trim() } }),
    onSuccess: () => {
      setNewLabel("");
      invalidate();
    },
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; label?: string }) => updateGalleryFn({ data: v }),
    onSuccess: invalidate,
  });
  const moveMut = useMutation({
    mutationFn: (v: { id: string; direction: "up" | "down" }) => moveGalleryFn({ data: v }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGalleryFn({ data: { id } }),
    onSuccess: invalidate,
  });

  const itemsByGallery = useMemo(() => {
    const map: Record<string, GalleryItem[]> = {};
    for (const it of allItems) (map[it.gallery_id] ??= []).push(it);
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [allItems]);

  const allowedModes = (category.media_modes?.length ? category.media_modes : ["image"]) as MediaMode[];

  return (
    <div
      className="mb-8 rounded-lg border p-4"
      style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }}
    >
      <div className="mb-1 text-sm font-medium opacity-80">Galleries in {category.label}</div>
      <div className="mb-3 text-xs opacity-60">
        Allowed media: {allowedModes.map((m) => (m === "video" ? "videos" : "images")).join(" + ")}.
        Change this in the category panel above.
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New gallery name (e.g. 2024 Conference)"
          className="flex-1 rounded-md border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--eyeframe-card)",
            borderColor: "var(--eyeframe-border)",
            color: "var(--eyeframe-text)",
          }}
        />
        <button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={!newLabel.trim() || createMut.isPending}
          className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
        >
          <Plus className="h-4 w-4" /> New gallery
        </button>
      </div>

      {galleries.length === 0 && (
        <div className="rounded-md border p-3 text-sm opacity-60"
          style={{ borderColor: "var(--eyeframe-border)" }}>
          No galleries yet. Add one above.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {galleries.map((g, idx) => {
          const items = itemsByGallery[g.id] ?? [];
          const isOpen = openIds.has(g.id);
          return (
            <div
              key={g.id}
              className="rounded-md border"
              style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-card)" }}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.id)) next.delete(g.id);
                      else next.add(g.id);
                      return next;
                    })
                  }
                  className="rounded-md p-1 hover:brightness-125"
                  title={isOpen ? "Collapse" : "Expand"}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <input
                  defaultValue={g.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== g.label) updateMut.mutate({ id: g.id, label: v });
                  }}
                  className="flex-1 rounded-md border bg-transparent px-2 py-1 text-sm outline-none"
                  style={{ borderColor: "transparent", color: "var(--eyeframe-text)" }}
                />
                <span className="text-xs opacity-60">{items.length} item{items.length === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  onClick={() => moveMut.mutate({ id: g.id, direction: "up" })}
                  disabled={idx === 0}
                  className="rounded-md border p-1 disabled:opacity-30"
                  style={{ borderColor: "var(--eyeframe-border)" }}
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveMut.mutate({ id: g.id, direction: "down" })}
                  disabled={idx === galleries.length - 1}
                  className="rounded-md border p-1 disabled:opacity-30"
                  style={{ borderColor: "var(--eyeframe-border)" }}
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete gallery "${g.label}" and all its items?`)) deleteMut.mutate(g.id);
                  }}
                  className="rounded-md border p-1"
                  style={{ borderColor: "var(--eyeframe-border)", color: "tomato" }}
                  title="Delete gallery"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isOpen && (
                <GalleryItems
                  gallery={g}
                  items={items}
                  allowedModes={allowedModes}
                  onChange={invalidate}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalleryItems({
  gallery,
  items,
  allowedModes,
  onChange,
}: {
  gallery: Gallery;
  items: GalleryItem[];
  allowedModes: MediaMode[];
  onChange: () => void;
}) {
  const addItemFn = useServerFn(addGalleryItem);
  const updateItemFn = useServerFn(updateGalleryItem);
  const deleteItemFn = useServerFn(deleteGalleryItem);
  const moveItemFn = useServerFn(moveGalleryItem);
  const uploadVideo = useServerFn(uploadEventVideo);
  const uploadMediaFn = useServerFn(uploadMedia);
  const fetchMedia = useServerFn(listMedia);

  const [busy, setBusy] = useState<string | null>(null);
  const [pickerKind, setPickerKind] = useState<MediaMode | null>(null);

  const { data: mediaLib = [] } = useQuery<MediaAsset[]>({
    queryKey: ["media", pickerKind],
    queryFn: () => fetchMedia({ data: pickerKind ? { kind: pickerKind } : undefined }),
    enabled: pickerKind !== null,
  });

  const handleUpload = async (kind: MediaMode, file: File) => {
    setBusy("upload");
    try {
      if (kind === "video") {
        const fd = new FormData();
        fd.append("file", file);
        const { publicUrl } = await uploadVideo({ data: fd });
        await addItemFn({
          data: { galleryId: gallery.id, kind, storagePath: publicUrl, label: file.name },
        });
      } else {
        const fd = new FormData();
        fd.append("file", file);
        const asset = await uploadMediaFn({ data: fd });
        await addItemFn({
          data: {
            galleryId: gallery.id,
            kind: "image",
            mediaAssetId: asset.id,
            storagePath: asset.public_url,
            thumbnailUrl: asset.public_url,
            label: asset.filename,
          },
        });
      }
      onChange();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickFromLibrary = async (asset: MediaAsset) => {
    setBusy("pick");
    try {
      const kind: MediaMode = asset.kind === "video" ? "video" : "image";
      await addItemFn({
        data: {
          galleryId: gallery.id,
          kind,
          mediaAssetId: asset.id,
          storagePath: asset.public_url,
          thumbnailUrl: kind === "image" ? asset.public_url : null,
          label: asset.filename,
        },
      });
      setPickerKind(null);
      onChange();
    } finally {
      setBusy(null);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteItemFn({ data: { id } }),
    onSuccess: onChange,
  });
  const moveMut = useMutation({
    mutationFn: (v: { id: string; direction: "up" | "down" }) => moveItemFn({ data: v }),
    onSuccess: onChange,
  });
  const renameMut = useMutation({
    mutationFn: (v: { id: string; label: string }) => updateItemFn({ data: v }),
    onSuccess: onChange,
  });

  return (
    <div className="border-t p-3" style={{ borderColor: "var(--eyeframe-border)" }}>
      {/* Add toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {allowedModes.includes("video") && (
          <label
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <Upload className="h-3.5 w-3.5" /> {busy === "upload" ? "Uploading…" : "Upload video"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload("video", e.target.files[0])}
            />
          </label>
        )}
        {allowedModes.includes("image") && (
          <label
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <Upload className="h-3.5 w-3.5" /> {busy === "upload" ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload("image", e.target.files[0])}
            />
          </label>
        )}
        {allowedModes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPickerKind(m)}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <Library className="h-3.5 w-3.5" /> Pick {m} from library
          </button>
        ))}
      </div>

      {pickerKind && (
        <div className="mb-3 rounded-md border p-2"
          style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-topbar)" }}>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="opacity-70">Media library — {pickerKind}s</span>
            <button type="button" onClick={() => setPickerKind(null)} className="opacity-70 hover:opacity-100">
              Close
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {mediaLib.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy !== null}
                onClick={() => pickFromLibrary(a)}
                className="overflow-hidden rounded-md border text-left transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "var(--eyeframe-border)" }}
              >
                {a.kind === "image" ? (
                  <img src={a.public_url} alt={a.filename} className="h-20 w-full object-cover" />
                ) : (
                  <div className="flex h-20 w-full items-center justify-center bg-black/40">
                    <Film className="h-6 w-6 opacity-70" />
                  </div>
                )}
                <div className="truncate px-1 py-0.5 text-[10px] opacity-70">{a.filename}</div>
              </button>
            ))}
            {mediaLib.length === 0 && (
              <div className="col-span-full p-2 text-xs opacity-60">
                No {pickerKind} assets in library. Upload via the Media Hub tab.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="text-xs opacity-60">No items yet. Upload or pick from library.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, idx) => (
            <div
              key={it.id}
              className="overflow-hidden rounded-md border"
              style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-topbar)" }}
            >
              <div className="relative aspect-video w-full bg-black/40">
                {it.kind === "image" && it.thumbnail_url ? (
                  <img src={it.thumbnail_url} alt={it.label ?? ""} className="h-full w-full object-cover" />
                ) : it.kind === "video" && it.storage_path ? (
                  <video src={it.storage_path} className="h-full w-full object-cover" preload="metadata" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {it.kind === "video" ? <Film className="h-6 w-6 opacity-70" /> : <ImageIcon className="h-6 w-6 opacity-70" />}
                  </div>
                )}
                <span
                  className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white"
                >
                  {it.kind}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1.5">
                <input
                  defaultValue={it.label ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (it.label ?? "")) renameMut.mutate({ id: it.id, label: v });
                  }}
                  placeholder="Label"
                  className="flex-1 rounded border bg-transparent px-1.5 py-0.5 text-xs outline-none"
                  style={{ borderColor: "transparent", color: "var(--eyeframe-text)" }}
                />
                <button
                  type="button"
                  onClick={() => moveMut.mutate({ id: it.id, direction: "up" })}
                  disabled={idx === 0}
                  className="rounded border p-0.5 disabled:opacity-30"
                  style={{ borderColor: "var(--eyeframe-border)" }}
                  title="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveMut.mutate({ id: it.id, direction: "down" })}
                  disabled={idx === items.length - 1}
                  className="rounded border p-0.5 disabled:opacity-30"
                  style={{ borderColor: "var(--eyeframe-border)" }}
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove this item from the gallery?")) deleteMut.mutate(it.id);
                  }}
                  className="rounded border p-0.5"
                  style={{ borderColor: "var(--eyeframe-border)", color: "tomato" }}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
