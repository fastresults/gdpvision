import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, RefreshCw, Trash2, X, Check, Film, FileText, Library, Upload, Copy, Star, Loader2, AlertCircle, RotateCw } from "lucide-react";

const PresentationUpload = lazy(() => import("@/components/admin/PresentationUpload"));
const CategoryManager = lazy(() => import("@/components/admin/CategoryManager"));
const GalleryManager = lazy(() => import("@/components/admin/GalleryManager"));
import {
  createItem,
  deleteItem,
  listItems,
  moveItem,
  refreshFavicons,
  updateItem,
  uploadEventVideo,
  generateItemThumbnail,
  refreshAllThumbnails,
  VIDEO_CATEGORIES,
  type Item,
  type ItemCategory,
} from "@/lib/items.functions";
import {
  listMedia,
  deleteMedia,
  renameMedia,
  setItemFaviconAsset,
  type MediaAsset,
  type MediaKind,
} from "@/lib/media.functions";
import {
  listSettings,
  updateSetting,
  type SettingKey,
  type Settings,
} from "@/lib/settings.functions";
import {
  listIdleImages,
  addIdleImage,
  updateIdleImage,
  removeIdleImage,
  moveIdleImage,
  type IdleImage,
} from "@/lib/idle-images.functions";
import { listCategories, type Category } from "@/lib/categories.functions";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "GDP Vision — Admin" },
      { name: "description", content: "Manage GDP Vision kiosk resources." },
    ],
  }),
  component: AdminPage,
});

const CATEGORY_KEYS: ItemCategory[] = ["websites", "presentations", "docs", "videos", "brand"];

const CATEGORY_TO_SETTING: Record<ItemCategory, SettingKey> = {
  websites: "label_websites",
  presentations: "label_presentations",
  docs: "label_docs",
  videos: "label_videos",
  brand: "label_brand",
};

function InlineEditable({
  value,
  onSave,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`group inline-flex items-center gap-2 ${className ?? ""}`}
        title="Click to rename"
      >
        <span>{value}</span>
        <Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={`rounded-md border px-2 py-1 outline-none ${inputClassName ?? ""}`}
      style={{
        backgroundColor: "var(--eyeframe-card)",
        borderColor: "var(--eyeframe-accent)",
        color: "var(--eyeframe-text)",
      }}
    />
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const fetchItems = useServerFn(listItems);
  const fetchSettings = useServerFn(listSettings);
  const create = useServerFn(createItem);
  const update = useServerFn(updateItem);
  const remove = useServerFn(deleteItem);
  const move = useServerFn(moveItem);
  const saveSetting = useServerFn(updateSetting);
  const refresh = useServerFn(refreshFavicons);
  const genThumb = useServerFn(generateItemThumbnail);
  const refreshThumbs = useServerFn(refreshAllThumbnails);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => fetchSettings(),
  });

  const labels: Settings = settings ?? {
    admin_title: "GDP Vision Admin",
    kiosk_title: "GDP Vision",
    label_websites: "Websites",
    label_presentations: "Presentations",
    label_docs: "Google Docs",
    label_videos: "Past Events",
    label_brand: "Brand Building",
    idle_image_url: "",
  };

  const fetchCategories = useServerFn(listCategories);
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(),
  });

  const categoryTabs = useMemo(
    () => categories.map((c) => ({ key: c.slug, label: c.label, behavior: c.behavior })),
    [categories],
  );

  type TabKey = string;
  const [tab, setTab] = useState<TabKey>("");
  const isMediaTab = tab === "media";
  // Default to first category when categories load
  useEffect(() => {
    if (categories.length === 0) return;
    if (!tab || (tab !== "media" && !categories.some((c) => c.slug === tab))) {
      setTab(categories[0].slug);
    }
  }, [categories, tab]);
  const categoryTab = (isMediaTab ? categories[0]?.slug ?? "" : tab);
  const currentCategory = categories.find((c) => c.slug === categoryTab);
  const tabBehavior = currentCategory?.behavior;
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [tooltip, setTooltip] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editTooltip, setEditTooltip] = useState("");

  const isVideoTab = !isMediaTab && tabBehavior === "video";
  const isPdfTab = !isMediaTab && tabBehavior === "pdf";
  const isGalleryTab = !isMediaTab && tabBehavior === "gallery";
  const uploadVideo = useServerFn(uploadEventVideo);

  const visible = useMemo(
    () =>
      items
        .filter((i) => i.category === categoryTab)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items, categoryTab],
  );

  const invalidateItems = () => qc.invalidateQueries({ queryKey: ["items"] });
  const invalidateSettings = () => qc.invalidateQueries({ queryKey: ["settings"] });

  const createMut = useMutation({
    mutationFn: async () => {
      let finalUrl = url;
      if (isVideoTab) {
        if (!file) throw new Error("Please choose a video file");
        const fd = new FormData();
        fd.append("file", file);
        const { publicUrl } = await uploadVideo({ data: fd });
        finalUrl = publicUrl;
      }
      const res = await create({ data: { category: categoryTab, label, url: finalUrl, tooltip: tooltip.trim() || null } });
      // Kick off thumbnail generation for non-video items (don't block UI)
      if (res?.id && !isVideoTab) {
        genThumb({ data: { id: res.id } })
          .then(() => qc.invalidateQueries({ queryKey: ["items"] }))
          .catch(() => {});
      }
      return res;
    },
    onSuccess: () => {
      setLabel("");
      setUrl("");
      setTooltip("");
      setFile(null);
      invalidateItems();
    },
  });

  const fetchMedia = useServerFn(listMedia);
  const setFaviconAsset = useServerFn(setItemFaviconAsset);
  const { data: mediaImages = [] } = useQuery({
    queryKey: ["media", "image"],
    queryFn: () => fetchMedia({ data: { kind: "image" } }),
  });

  const updateMut = useMutation({
    mutationFn: (item: Item) =>
      update({
        data: { id: item.id, label: editLabel, url: editUrl, tooltip: editTooltip.trim() || null },
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidateItems();
    },
  });

  const faviconAssetMut = useMutation({
    mutationFn: ({ itemId, assetId }: { itemId: string; assetId: string | null }) =>
      setFaviconAsset({ data: { itemId, assetId } }),
    onSuccess: invalidateItems,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidateItems,
  });

  const moveMut = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      move({ data: { id, direction } }),
    onSuccess: invalidateItems,
  });

  const settingMut = useMutation({
    mutationFn: ({ key, value }: { key: SettingKey; value: string }) =>
      saveSetting({ data: { key, value } }),
    onSuccess: invalidateSettings,
  });

  const refreshMut = useMutation({
    mutationFn: () => refresh(),
    onSuccess: invalidateItems,
  });

  const regenOneMut = useMutation({
    mutationFn: (id: string) => genThumb({ data: { id } }),
    onSuccess: invalidateItems,
  });

  const refreshThumbsMut = useMutation({
    mutationFn: (force: boolean) => refreshThumbs({ data: { force } }),
    onSuccess: invalidateItems,
  });

  return (
    <div
      className="min-h-screen w-full px-6 py-8"
      style={{
        backgroundColor: "var(--eyeframe-bg)",
        color: "var(--eyeframe-text)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6" style={{ color: "var(--eyeframe-accent)" }} />
              <h1 className="text-2xl font-semibold tracking-tight">
                <InlineEditable
                  value={labels.admin_title}
                  onSave={(v) => settingMut.mutate({ key: "admin_title", value: v })}
                  inputClassName="text-2xl font-semibold tracking-tight"
                />
              </h1>
            </div>
            <div className="pl-9 text-xs opacity-70">
              Kiosk title:&nbsp;
              <InlineEditable
                value={labels.kiosk_title}
                onSave={(v) => settingMut.mutate({ key: "kiosk_title", value: v })}
                inputClassName="text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshThumbsMut.mutate(false)}
              disabled={refreshThumbsMut.isPending}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:brightness-125 disabled:opacity-50"
              style={{
                backgroundColor: "var(--eyeframe-topbar)",
                borderColor: "var(--eyeframe-border)",
              }}
              title="Generate thumbnails for pending or failed items"
            >
              <RefreshCw className={`h-4 w-4 ${refreshThumbsMut.isPending ? "animate-spin" : ""}`} />
              {refreshThumbsMut.isPending ? "Generating…" : "Refresh thumbnails"}
            </button>
            <button
              type="button"
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:brightness-125 disabled:opacity-50"
              style={{
                backgroundColor: "var(--eyeframe-topbar)",
                borderColor: "var(--eyeframe-border)",
              }}
              title="Re-fetch favicons for all items"
            >
              <RefreshCw className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
              Refresh favicons
            </button>
            <Link
              to="/"
              className="rounded-md border px-3 py-2 text-sm transition-colors hover:brightness-125"
              style={{
                backgroundColor: "var(--eyeframe-topbar)",
                borderColor: "var(--eyeframe-border)",
              }}
            >
              Open Kiosk
            </Link>
          </div>
        </header>


        <Suspense fallback={null}>
          <CategoryManager />
        </Suspense>



        <div className="mb-6 flex flex-wrap gap-2">
          {categoryTabs.map((t) => {
            const isActive = tab === t.key;
            return (
              <div
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--eyeframe-accent)" : "var(--eyeframe-card)",
                  color: isActive ? "var(--eyeframe-bg)" : "var(--eyeframe-text)",
                  borderColor: isActive ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
                }}
              >
                <span>{t.label}</span>
              </div>
            );
          })}
          <div
            onClick={() => setTab("media")}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === "media" ? "var(--eyeframe-accent)" : "var(--eyeframe-card)",
              color: tab === "media" ? "var(--eyeframe-bg)" : "var(--eyeframe-text)",
              borderColor: tab === "media" ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
            }}
          >
            <Library className="h-4 w-4" />
            Media Hub
          </div>
        </div>

        {isMediaTab ? (
          <MediaHub />
        ) : (

        <div>


        <div className="mb-4 text-xs opacity-60">
          Tip: rename or reorder categories in the panel above. New categories appear here as tabs.
        </div>

        {isPdfTab ? (
          <Suspense
            fallback={
              <div className="mb-8 rounded-lg border p-4 text-sm opacity-60"
                style={{
                  backgroundColor: "var(--eyeframe-topbar)",
                  borderColor: "var(--eyeframe-border)",
                }}>
                Loading uploader…
              </div>
            }
          >
            <PresentationUpload onUploaded={invalidateItems} category={categoryTab} />
          </Suspense>
        ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            if (isVideoTab) {
              if (!file) return;
            } else if (!url.trim()) {
              return;
            }
            createMut.mutate();
          }}
          className="mb-8 rounded-lg border p-4"
          style={{
            backgroundColor: "var(--eyeframe-topbar)",
            borderColor: "var(--eyeframe-border)",
          }}
        >
          <div className="mb-3 text-sm font-medium opacity-80">
            Add to {categoryTabs.find((t) => t.key === categoryTab)?.label}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
              className="rounded-md border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--eyeframe-card)",
                borderColor: "var(--eyeframe-border)",
                color: "var(--eyeframe-text)",
              }}
            />
            {isVideoTab ? (
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--eyeframe-card)",
                  borderColor: "var(--eyeframe-border)",
                  color: "var(--eyeframe-text)",
                }}
              />
            ) : (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--eyeframe-card)",
                  borderColor: "var(--eyeframe-border)",
                  color: "var(--eyeframe-text)",
                }}
              />
            )}
            <button
              type="submit"
              disabled={createMut.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
            >
              <Plus className="h-4 w-4" />
              {isVideoTab ? (createMut.isPending ? "Uploading…" : "Upload") : "Add"}
            </button>
          </div>
          {!isVideoTab && (
            <div className="mt-3">
              <input
                value={tooltip}
                onChange={(e) => setTooltip(e.target.value)}
                placeholder="Tooltip (optional) — shown on hover, e.g. Caribbean Investment Summit"
                maxLength={300}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--eyeframe-card)",
                  borderColor: "var(--eyeframe-border)",
                  color: "var(--eyeframe-text)",
                }}
              />
            </div>
          )}
          {createMut.isError && (
            <div className="mt-2 text-xs text-red-400">
              {(createMut.error as Error).message}
            </div>
          )}
        </form>
        )}

        {/* List */}
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--eyeframe-border)" }}
        >
          {visible.length === 0 && (
            <div className="px-4 py-8 text-center text-sm opacity-60">No items yet.</div>
          )}
          {visible.map((item, idx) => {
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                style={{
                  backgroundColor: "var(--eyeframe-topbar)",
                  borderColor: "var(--eyeframe-border)",
                }}
              >
                {VIDEO_CATEGORIES.includes(item.category) ? (
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{ backgroundColor: "var(--eyeframe-card)", color: "var(--eyeframe-accent)" }}
                    title="Video"
                  >
                    <Film className="h-3.5 w-3.5" />
                  </div>
                ) : (item.favicon_asset_url || item.favicon_url) ? (
                  <img
                    src={item.favicon_asset_url ?? item.favicon_url ?? ""}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded"
                    title={item.favicon_asset_url ? "Custom favicon" : "Auto favicon"}
                  />
                ) : (
                  <div
                    className="h-6 w-6 shrink-0 rounded"
                    style={{ backgroundColor: "var(--eyeframe-card)" }}
                  />
                )}
                {isEditing && !VIDEO_CATEGORIES.includes(item.category) && (
                  <select
                    value={item.favicon_asset_id ?? ""}
                    onChange={(e) =>
                      faviconAssetMut.mutate({
                        itemId: item.id,
                        assetId: e.target.value || null,
                      })
                    }
                    className="rounded-md border px-2 py-1 text-xs outline-none"
                    style={{
                      backgroundColor: "var(--eyeframe-card)",
                      borderColor: "var(--eyeframe-border)",
                      color: "var(--eyeframe-text)",
                    }}
                    title="Custom favicon"
                  >
                    <option value="">Auto favicon</option>
                    {mediaImages.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.filename}
                      </option>
                    ))}
                  </select>
                )}
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-48 rounded-md border px-2 py-1 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--eyeframe-card)",
                          borderColor: "var(--eyeframe-border)",
                          color: "var(--eyeframe-text)",
                        }}
                      />
                      <input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--eyeframe-card)",
                          borderColor: "var(--eyeframe-border)",
                          color: "var(--eyeframe-text)",
                        }}
                      />
                    </div>
                    <input
                      value={editTooltip}
                      onChange={(e) => setEditTooltip(e.target.value)}
                      placeholder="Tooltip (optional)"
                      maxLength={300}
                      className="w-full rounded-md border px-2 py-1 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--eyeframe-card)",
                        borderColor: "var(--eyeframe-border)",
                        color: "var(--eyeframe-text)",
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-48 shrink-0 truncate text-sm font-medium">
                      {item.label}
                      {item.tooltip && (
                        <div className="truncate text-[10px] font-normal opacity-60">{item.tooltip}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 truncate text-xs opacity-70">{item.url}</div>
                  </>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {!VIDEO_CATEGORIES.includes(item.category) && (
                    <button
                      type="button"
                      title={
                        item.thumbnail_error
                          ? `Thumbnail: ${item.thumbnail_status} — ${item.thumbnail_error}`
                          : `Thumbnail: ${item.thumbnail_status}`
                      }
                      onClick={() => regenOneMut.mutate(item.id)}
                      disabled={regenOneMut.isPending}
                      className="rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors hover:brightness-125 disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--eyeframe-card)",
                        borderColor:
                          item.thumbnail_status === "ready"
                            ? "var(--eyeframe-accent)"
                            : item.thumbnail_status === "failed"
                              ? "#ff8a8a"
                              : "var(--eyeframe-border)",
                        color:
                          item.thumbnail_status === "ready"
                            ? "var(--eyeframe-accent)"
                            : item.thumbnail_status === "failed"
                              ? "#ff8a8a"
                              : "var(--eyeframe-text)",
                      }}
                    >
                      {item.thumbnail_status}
                    </button>
                  )}
                  <button
                    type="button"
                    title="Move up"
                    disabled={idx === 0}
                    onClick={() => moveMut.mutate({ id: item.id, direction: "up" })}
                    className="rounded-md p-2 transition-colors hover:brightness-125 disabled:opacity-30"
                    style={{ backgroundColor: "var(--eyeframe-card)" }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={idx === visible.length - 1}
                    onClick={() => moveMut.mutate({ id: item.id, direction: "down" })}
                    className="rounded-md p-2 transition-colors hover:brightness-125 disabled:opacity-30"
                    style={{ backgroundColor: "var(--eyeframe-card)" }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        title="Save"
                        onClick={() => updateMut.mutate(item)}
                        className="rounded-md p-2"
                        style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Cancel"
                        onClick={() => setEditingId(null)}
                        className="rounded-md p-2"
                        style={{ backgroundColor: "var(--eyeframe-card)" }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditLabel(item.label);
                          setEditUrl(item.url);
                          setEditTooltip(item.tooltip ?? "");
                        }}
                        className="rounded-md p-2 transition-colors hover:brightness-125"
                        style={{ backgroundColor: "var(--eyeframe-card)" }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Delete "${item.label}"?`)) deleteMut.mutate(item.id);
                        }}
                        className="rounded-md p-2 transition-colors hover:brightness-125"
                        style={{ backgroundColor: "var(--eyeframe-card)", color: "#ff8a8a" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        )}
      </div>
    </div>
  );
}

function MediaHub() {
  const qc = useQueryClient();
  const fetchMedia = useServerFn(listMedia);
  const fetchIdle = useServerFn(listIdleImages);
  const addIdle = useServerFn(addIdleImage);
  const updateIdle = useServerFn(updateIdleImage);
  const removeIdle = useServerFn(removeIdleImage);
  const moveIdle = useServerFn(moveIdleImage);

  const remove = useServerFn(deleteMedia);
  const rename = useServerFn(renameMedia);

  const [filter, setFilter] = useState<MediaKind | "all">("all");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idleInputRef = useRef<HTMLInputElement>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ["media"],
    queryFn: () => fetchMedia({ data: {} }),
  });
  const { data: idleImages = [] } = useQuery<IdleImage[]>({
    queryKey: ["idle-images"],
    queryFn: () => fetchIdle(),
  });
  const idleUrls = useMemo(() => new Set(idleImages.map((i) => i.image_url)), [idleImages]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["media"] });
  const invalidateIdle = () => qc.invalidateQueries({ queryKey: ["idle-images"] });


  const uploadOne = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/upload-media", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body?.error || `Upload failed (${res.status})`);
    }
    return (await res.json()) as MediaAsset;
  };

  type QueueItem = {
    id: string;
    file: File;
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
  };
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isMainDragging, setIsMainDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const MAX_PARALLEL = 3;

  // Worker: keeps up to MAX_PARALLEL uploads in flight
  useEffect(() => {
    const activeCount = queue.filter((q) => q.status === "uploading").length;
    if (activeCount >= MAX_PARALLEL) return;
    const next = queue.find((q) => q.status === "pending");
    if (!next) return;
    // Mark as uploading
    setQueue((prev) => prev.map((q) => (q.id === next.id ? { ...q, status: "uploading" } : q)));
    uploadOne(next.file)
      .then(() => {
        setQueue((prev) => prev.map((q) => (q.id === next.id ? { ...q, status: "done" } : q)));
        invalidate();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[uploadMedia] failed:", err);
        setQueue((prev) =>
          prev.map((q) => (q.id === next.id ? { ...q, status: "error", error: msg } : q)),
        );
      });
  }, [queue]);

  const enqueueFiles = (files: File[] | FileList) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setQueue((prev) => [
      ...prev,
      ...arr.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
        file,
        status: "pending" as const,
      })),
    ]);
  };

  const retryItem = (id: string) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "pending", error: undefined } : q)),
    );
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((q) => q.status !== "done"));
  };


  const uploadIdleMut = useMutation({
    mutationFn: async (file: File) => {
      const asset = await uploadOne(file);
      if (asset?.public_url) {
        await addIdle({
          data: {
            image_url: asset.public_url,
            media_asset_id: asset.id,
            caption: null,
          },
        });
      }
      return asset;
    },
    onSuccess: () => {
      invalidate();
      invalidateIdle();
    },
    onError: (err) => {
      console.error("[uploadMedia idle] failed:", err);
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const addToCarouselMut = useMutation({
    mutationFn: (asset: MediaAsset) =>
      addIdle({ data: { image_url: asset.public_url, media_asset_id: asset.id, caption: null } }),
    onSuccess: invalidateIdle,
  });

  const removeFromCarouselMut = useMutation({
    mutationFn: (id: string) => removeIdle({ data: { id } }),
    onSuccess: invalidateIdle,
  });

  const moveIdleMut = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      moveIdle({ data: { id, direction } }),
    onSuccess: invalidateIdle,
  });

  const updateIdleMut = useMutation({
    mutationFn: ({ id, caption }: { id: string; caption: string | null }) =>
      updateIdle({ data: { id, caption } }),
    onSuccess: invalidateIdle,
  });


  const renameMut = useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      rename({ data: { id, filename } }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });

  const filtered = useMemo(
    () => (filter === "all" ? assets : assets.filter((a) => a.kind === filter)),
    [assets, filter],
  );

  const FILTERS: { key: MediaKind | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "image", label: "Images" },
    { key: "video", label: "Videos" },
    { key: "pdf", label: "PDFs" },
    { key: "document", label: "Documents" },
  ];

  const formatSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div>
      {/* Idle carousel panel */}
      <div
        className="mb-6 rounded-lg border p-4"
        style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium opacity-80">
            <Star className="h-4 w-4" /> Kiosk idle carousel
          </div>
          <div className="text-xs opacity-60">
            {idleImages.length} image{idleImages.length === 1 ? "" : "s"} — auto-rotates on kiosk
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            // 1) dragged from media library
            const assetPayload = e.dataTransfer.getData("application/x-media-asset");
            if (assetPayload) {
              try {
                const { id, url } = JSON.parse(assetPayload) as { id: string; url: string };
                if (idleUrls.has(url)) return; // already in carousel
                addToCarouselMut.mutate({
                  id,
                  public_url: url,
                  filename: "",
                  mime_type: "",
                  size_bytes: 0,
                  storage_path: "",
                  kind: "image",
                  created_at: "",
                });
              } catch {
                // ignore malformed payload
              }
              return;
            }
            // 2) file dropped from OS
            const f = e.dataTransfer.files?.[0];
            if (!f) return;
            if (!f.type.startsWith("image/")) {
              alert("Please drop an image file (PNG, JPG, SVG, WebP, GIF).");
              return;
            }
            uploadIdleMut.mutate(f);
          }}
          onClick={() => idleInputRef.current?.click()}
          className="mb-3 flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed p-3 text-xs transition-colors"
          style={{
            borderColor: isDragging ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
            backgroundColor: isDragging ? "color-mix(in oklab, var(--eyeframe-accent) 10%, transparent)" : "transparent",
          }}
        >

          <input
            ref={idleInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadIdleMut.mutate(f);
              if (idleInputRef.current) idleInputRef.current.value = "";
            }}
          />
          <Upload className="h-4 w-4 opacity-60" />
          <div className="flex-1 opacity-70">
            {uploadIdleMut.isPending
              ? "Uploading…"
              : isDragging
                ? <span style={{ color: "var(--eyeframe-accent)" }}>Drop image to add to carousel</span>
                : "Drag images here from the library below, drop a new image from your computer, or click to upload."}
            {uploadIdleMut.isError && (
              <div className="mt-1 text-red-400">{(uploadIdleMut.error as Error).message}</div>
            )}
          </div>
        </div>

        {idleImages.length === 0 ? (
          <div className="rounded-md border px-3 py-6 text-center text-xs opacity-60"
            style={{ borderColor: "var(--eyeframe-border)" }}>
            No carousel images yet. Upload above or star images in the library.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {idleImages.map((img, idx) => (
              <div
                key={img.id}
                className="flex w-56 flex-col overflow-hidden rounded-md border"
                style={{ backgroundColor: "var(--eyeframe-card)", borderColor: "var(--eyeframe-border)" }}
              >
                <div className="flex h-28 items-center justify-center overflow-hidden"
                  style={{ backgroundColor: "var(--eyeframe-bg)" }}>
                  <img src={img.image_url} alt={img.caption ?? ""} className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col gap-2 p-2">
                  <input
                    defaultValue={img.caption ?? ""}
                    placeholder="Caption (optional)"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (img.caption ?? "")) {
                        updateIdleMut.mutate({ id: img.id, caption: v || null });
                      }
                    }}
                    className="rounded border px-2 py-1 text-xs outline-none"
                    style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)", color: "var(--eyeframe-text)" }}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => moveIdleMut.mutate({ id: img.id, direction: "up" })}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30"
                      style={{ borderColor: "var(--eyeframe-border)" }}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={idx === idleImages.length - 1}
                      onClick={() => moveIdleMut.mutate({ id: img.id, direction: "down" })}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30"
                      style={{ borderColor: "var(--eyeframe-border)" }}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Remove from carousel"
                      onClick={() => removeFromCarouselMut.mutate(img.id)}
                      className="ml-auto rounded border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--eyeframe-border)", color: "#ff8a8a" }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Upload dropzone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepthRef.current += 1;
          setIsMainDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsMainDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepthRef.current = 0;
          setIsMainDragging(false);
          const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.size > 0);
          if (files.length) enqueueFiles(files);
        }}
        onClick={() => inputRef.current?.click()}
        className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors"
        style={{
          borderColor: isMainDragging ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
          backgroundColor: isMainDragging
            ? "color-mix(in oklab, var(--eyeframe-accent) 12%, transparent)"
            : "var(--eyeframe-topbar)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.ppt,.pptx"
          onChange={(e) => {
            if (e.target.files?.length) enqueueFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="hidden"
        />
        <Upload className="h-7 w-7 opacity-70" />
        <div className="text-sm font-medium">
          {isMainDragging ? (
            <span style={{ color: "var(--eyeframe-accent)" }}>Drop files to upload</span>
          ) : (
            "Drag & drop files here, or click to browse"
          )}
        </div>
        <div className="text-xs opacity-60">
          Images (PNG, JPG, WebP, SVG, GIF) · Videos (MP4, WebM, MOV) · PDFs · Word & PowerPoint. Up to 3 upload in parallel.
        </div>
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div
          className="mb-6 rounded-lg border"
          style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2 text-xs"
            style={{ borderColor: "var(--eyeframe-border)" }}
          >
            <div className="opacity-70">
              {queue.filter((q) => q.status === "done").length} uploaded ·{" "}
              {queue.filter((q) => q.status === "error").length} failed ·{" "}
              {queue.filter((q) => q.status === "pending" || q.status === "uploading").length} remaining
            </div>
            {queue.some((q) => q.status === "done") && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs underline opacity-70 hover:opacity-100"
              >
                Clear completed
              </button>
            )}
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--eyeframe-border)" }}>
            {queue.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{q.file.name}</div>
                  <div className="opacity-60">{formatSize(q.file.size)}</div>
                  {q.status === "error" && q.error && (
                    <div className="mt-0.5 text-red-400">{q.error}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {q.status === "pending" && <span className="opacity-70">Pending</span>}
                  {q.status === "uploading" && (
                    <span className="inline-flex items-center gap-1" style={{ color: "var(--eyeframe-accent)" }}>
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                    </span>
                  )}
                  {q.status === "done" && (
                    <span className="inline-flex items-center gap-1 text-green-400">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  )}
                  {q.status === "error" && (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <AlertCircle className="h-3 w-3" /> Failed
                    </span>
                  )}
                  {q.status === "error" && (
                    <button
                      type="button"
                      onClick={() => retryItem(q.id)}
                      title="Retry"
                      className="rounded p-1 opacity-70 hover:opacity-100"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  )}
                  {(q.status === "error" || q.status === "done" || q.status === "pending") && (
                    <button
                      type="button"
                      onClick={() => removeItem(q.id)}
                      title="Remove"
                      className="rounded p-1 opacity-70 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}


      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? "var(--eyeframe-accent)" : "var(--eyeframe-card)",
                color: isActive ? "var(--eyeframe-bg)" : "var(--eyeframe-text)",
                borderColor: isActive ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
              }}
            >
              {f.label}
            </button>
          );
        })}
        <div className="ml-auto self-center text-xs opacity-60">{filtered.length} items</div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="rounded-lg border px-4 py-12 text-center text-sm opacity-60"
          style={{ borderColor: "var(--eyeframe-border)" }}
        >
          No media yet. Upload some files to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((a) => (
            <MediaCard
              key={a.id}
              asset={a}
              isIdle={idleUrls.has(a.public_url)}
              onSetIdle={() => {
                const existing = idleImages.find((i) => i.image_url === a.public_url);
                if (existing) removeFromCarouselMut.mutate(existing.id);
                else addToCarouselMut.mutate(a);
              }}

              onRename={(filename) => renameMut.mutate({ id: a.id, filename })}
              onDelete={() => {
                if (confirm(`Delete "${a.filename}"?`)) deleteMut.mutate(a.id);
              }}
              formatSize={formatSize}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({
  asset,
  isIdle,
  onSetIdle,
  onRename,
  onDelete,
  formatSize,
}: {
  asset: MediaAsset;
  isIdle: boolean;
  onSetIdle: () => void;
  onRename: (filename: string) => void;
  onDelete: () => void;
  formatSize: (b: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asset.filename);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(asset.public_url);
    } catch {
      // ignore
    }
  };

  const isImage = asset.kind === "image";
  return (
    <div
      draggable={isImage}
      onDragStart={(e) => {
        if (!isImage) return;
        const payload = JSON.stringify({ id: asset.id, url: asset.public_url });
        e.dataTransfer.setData("application/x-media-asset", payload);
        e.dataTransfer.setData("text/plain", asset.public_url);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex flex-col overflow-hidden rounded-lg border"
      style={{
        backgroundColor: "var(--eyeframe-topbar)",
        borderColor: isIdle ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
        cursor: isImage ? "grab" : undefined,
      }}
    >

      <div
        className="flex aspect-video items-center justify-center overflow-hidden"
        style={{ backgroundColor: "var(--eyeframe-card)" }}
      >
        {asset.kind === "image" ? (
          <img src={asset.public_url} alt={asset.filename} className="h-full w-full object-cover" />
        ) : asset.kind === "video" ? (
          <video src={asset.public_url} className="h-full w-full object-cover" muted />
        ) : asset.kind === "pdf" ? (
          <FileText className="h-12 w-12 opacity-50" />
        ) : (
          <FileText className="h-12 w-12 opacity-50" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const v = draft.trim();
              if (v && v !== asset.filename) onRename(v);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(asset.filename);
                setEditing(false);
              }
            }}
            className="rounded-md border px-2 py-1 text-xs outline-none"
            style={{ backgroundColor: "var(--eyeframe-card)", borderColor: "var(--eyeframe-border)", color: "var(--eyeframe-text)" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="truncate text-left text-xs font-medium"
          >
            {asset.filename}
          </button>
        )}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide opacity-60">
          <span>{asset.kind}</span>
          <span>{formatSize(asset.size_bytes)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={copyUrl}
            title="Copy URL"
            className="flex-1 rounded-md border px-2 py-1.5 text-xs"
            style={{ backgroundColor: "var(--eyeframe-card)", borderColor: "var(--eyeframe-border)" }}
          >
            <Copy className="mx-auto h-3.5 w-3.5" />
          </button>
          {asset.kind === "image" && (
            <button
              type="button"
              onClick={onSetIdle}
              title={isIdle ? "Remove from idle carousel" : "Add to idle carousel"}
              className="rounded-md border px-2 py-1.5 text-xs"
              style={{
                backgroundColor: isIdle ? "var(--eyeframe-accent)" : "var(--eyeframe-card)",
                color: isIdle ? "var(--eyeframe-bg)" : "var(--eyeframe-text)",
                borderColor: isIdle ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
              }}
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="rounded-md border px-2 py-1.5 text-xs"
            style={{ backgroundColor: "var(--eyeframe-card)", borderColor: "var(--eyeframe-border)", color: "#ff8a8a" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
