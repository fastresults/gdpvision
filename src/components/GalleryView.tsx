import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon, X } from "lucide-react";
import type { Category, Gallery, GalleryItem } from "@/lib/kiosk-types";

export function GalleryView({
  category,
  galleries,
  items,
}: {
  category: Category;
  galleries: Gallery[];
  items: GalleryItem[];
}) {
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);

  useEffect(() => {
    setSelectedGalleryId(null);
    setActiveItemIdx(null);
  }, [category.id]);

  const galleriesForCat = useMemo(
    () => galleries.filter((g) => g.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order),
    [galleries, category.id],
  );

  const selectedGallery = galleriesForCat.find((g) => g.id === selectedGalleryId) ?? null;
  const galleryItems = useMemo(() => {
    if (!selectedGallery) return [];
    return items
      .filter((it) => it.gallery_id === selectedGallery.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [items, selectedGallery]);

  const coverForGallery = (g: Gallery): string | null => {
    if (g.cover_url) return g.cover_url;
    const first = items
      .filter((it) => it.gallery_id === g.id && it.thumbnail_url)
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    return first?.thumbnail_url ?? null;
  };

  // Item viewer
  if (selectedGallery && activeItemIdx !== null) {
    const item = galleryItems[activeItemIdx];
    if (!item) {
      setActiveItemIdx(null);
      return null;
    }
    const goPrev = () => setActiveItemIdx((i) => (i === null ? null : (i - 1 + galleryItems.length) % galleryItems.length));
    const goNext = () => setActiveItemIdx((i) => (i === null ? null : (i + 1) % galleryItems.length));
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {item.kind === "image" && item.storage_path ? (
          <img src={item.storage_path} alt={item.label ?? ""} className="max-h-full max-w-full object-contain" />
        ) : item.kind === "video" && item.storage_path ? (
          <video
            key={item.id}
            src={item.storage_path}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="text-white opacity-70">Unsupported item</div>
        )}

        <button
          type="button"
          onClick={() => setActiveItemIdx(null)}
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {galleryItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {item.label && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-3 py-1.5 text-sm text-white">
            {item.label}
          </div>
        )}
      </div>
    );
  }

  // Thumbnail grid of one gallery
  if (selectedGallery) {
    return (
      <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: "var(--eyeframe-bg)" }}>
        <div
          className="flex items-center gap-3 border-b px-6 py-3"
          style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-topbar)" }}
        >
          <button
            type="button"
            onClick={() => setSelectedGalleryId(null)}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:brightness-125"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-lg font-semibold tracking-tight">{selectedGallery.label}</div>
          <div className="ml-auto text-xs opacity-60">{galleryItems.length} item{galleryItems.length === 1 ? "" : "s"}</div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {galleryItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm opacity-60">
              No items in this gallery yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {galleryItems.map((it, idx) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setActiveItemIdx(idx)}
                  className="group overflow-hidden rounded-lg border text-left transition-transform hover:scale-[1.02]"
                  style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-card)" }}
                >
                  <div className="relative aspect-video w-full bg-black/40">
                    {it.kind === "image" && it.thumbnail_url ? (
                      <img src={it.thumbnail_url} alt={it.label ?? ""} className="h-full w-full object-cover" />
                    ) : it.kind === "video" && it.storage_path ? (
                      <video src={it.storage_path} className="h-full w-full object-cover" preload="metadata" muted />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {it.kind === "video" ? <Film className="h-10 w-10 opacity-70" /> : <ImageIcon className="h-10 w-10 opacity-70" />}
                      </div>
                    )}
                    {it.kind === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-black/60 p-3 opacity-90 group-hover:opacity-100">
                          <Film className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  {it.label && (
                    <div className="truncate px-2 py-1.5 text-xs opacity-80">{it.label}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid of galleries
  return (
    <div className="absolute inset-0 overflow-auto p-6" style={{ backgroundColor: "var(--eyeframe-bg)" }}>
      {galleriesForCat.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm opacity-60">
          No galleries yet in this category. Add some in /admin.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {galleriesForCat.map((g) => {
            const cover = coverForGallery(g);
            const count = items.filter((it) => it.gallery_id === g.id).length;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGalleryId(g.id)}
                className="group overflow-hidden rounded-xl border text-left transition-transform hover:scale-[1.02]"
                style={{ borderColor: "var(--eyeframe-border)", backgroundColor: "var(--eyeframe-card)" }}
              >
                <div className="relative aspect-video w-full bg-black/40">
                  {cover ? (
                    <img src={cover} alt={g.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-12 w-12 opacity-50" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="truncate text-sm font-medium">{g.label}</div>
                  <div className="text-xs opacity-60">{count}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
