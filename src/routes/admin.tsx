import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, RefreshCw, Trash2, X, Check, Film, Image as ImageIcon, FileText, Library, Upload, Copy, Star } from "lucide-react";
import {
  createItem,
  deleteItem,
  listItems,
  moveItem,
  refreshFavicons,
  updateItem,
  uploadEventVideo,
  VIDEO_CATEGORIES,
  type Item,
  type ItemCategory,
} from "@/lib/items.functions";
import {
  listMedia,
  uploadMedia,
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

  const categoryTabs = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => ({
        key,
        label: labels[CATEGORY_TO_SETTING[key]],
      })),
    [labels],
  );

  type TabKey = ItemCategory | "media";
  const [tab, setTab] = useState<TabKey>("websites");
  const isMediaTab = tab === "media";
  const categoryTab = (isMediaTab ? "websites" : tab) as ItemCategory;
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const isVideoTab = !isMediaTab && VIDEO_CATEGORIES.includes(categoryTab);
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
      return create({ data: { category: categoryTab, label, url: finalUrl } });
    },
    onSuccess: () => {
      setLabel("");
      setUrl("");
      setFile(null);
      invalidateItems();
    },
  });

  const updateMut = useMutation({
    mutationFn: (item: Item) =>
      update({
        data: { id: item.id, label: editLabel, url: editUrl },
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidateItems();
    },
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
                <InlineEditable
                  value={t.label}
                  onSave={(v) =>
                    settingMut.mutate({ key: CATEGORY_TO_SETTING[t.key], value: v })
                  }
                  inputClassName="text-sm font-medium"
                />
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
          <MediaHub
            idleImageUrl={labels.idle_image_url}
            onSetIdle={(v) => settingMut.mutate({ key: "idle_image_url", value: v })}
          />
        ) : (
        <>


        <div className="mb-4 text-xs opacity-60">
          Tip: click any title or category name to rename it. The kiosk updates automatically.
        </div>

        {/* Add form */}
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
          {createMut.isError && (
            <div className="mt-2 text-xs text-red-400">
              {(createMut.error as Error).message}
            </div>
          )}
        </form>

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
                ) : item.favicon_url ? (
                  <img src={item.favicon_url} alt="" className="h-6 w-6 shrink-0 rounded" />
                ) : (
                  <div
                    className="h-6 w-6 shrink-0 rounded"
                    style={{ backgroundColor: "var(--eyeframe-card)" }}
                  />
                )}
                {isEditing ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="w-48 shrink-0 truncate text-sm font-medium">{item.label}</div>
                    <div className="min-w-0 flex-1 truncate text-xs opacity-70">{item.url}</div>
                  </>
                )}
                <div className="flex shrink-0 items-center gap-1">
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
        </>
        )}
      </div>
    </div>
  );
}

function MediaHub({ idleImageUrl, onSetIdle }: { idleImageUrl: string; onSetIdle: (v: string) => void }) {
  const qc = useQueryClient();
  const fetchMedia = useServerFn(listMedia);
  const upload = useServerFn(uploadMedia);
  const remove = useServerFn(deleteMedia);
  const rename = useServerFn(renameMedia);

  const [filter, setFilter] = useState<MediaKind | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ["media"],
    queryFn: () => fetchMedia({ data: {} }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["media"] });

  const uploadMut = useMutation({
    mutationFn: async (files: FileList) => {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        await upload({ data: fd });
      }
    },
    onSuccess: invalidate,
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
      {/* Idle screen panel */}
      <div
        className="mb-6 rounded-lg border p-4"
        style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }}
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-medium opacity-80">
          <Star className="h-4 w-4" /> Kiosk idle screen image
        </div>
        <div className="flex items-center gap-4">
          <div
            className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded border"
            style={{ backgroundColor: "var(--eyeframe-card)", borderColor: "var(--eyeframe-border)" }}
          >
            {idleImageUrl ? (
              <img src={idleImageUrl} alt="Idle" className="h-full w-full object-contain" />
            ) : (
              <Eye className="h-8 w-8 opacity-40" />
            )}
          </div>
          <div className="flex-1 text-xs opacity-70">
            {idleImageUrl
              ? "This image is shown full-screen on the kiosk before any resource is selected."
              : "No idle image set. The kiosk shows the eye-icon placeholder. Choose an image below and click the star to set it."}
          </div>
          {idleImageUrl && (
            <button
              type="button"
              onClick={() => onSetIdle("")}
              className="rounded-md border px-3 py-2 text-xs"
              style={{ backgroundColor: "var(--eyeframe-card)", borderColor: "var(--eyeframe-border)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Upload */}
      <div
        className="mb-6 rounded-lg border p-4"
        style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: "var(--eyeframe-border)" }}
      >
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.ppt,.pptx"
            onChange={(e) => {
              if (e.target.files?.length) uploadMut.mutate(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMut.isPending}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
          >
            <Upload className="h-4 w-4" />
            {uploadMut.isPending ? "Uploading…" : "Upload files"}
          </button>
          <div className="text-xs opacity-60">
            Images (PNG, JPG, WebP, SVG, GIF), Videos (MP4, WebM, MOV), PDFs, Word & PowerPoint.
          </div>
        </div>
        {uploadMut.isError && (
          <div className="mt-2 text-xs text-red-400">{(uploadMut.error as Error).message}</div>
        )}
      </div>

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
              isIdle={a.public_url === idleImageUrl}
              onSetIdle={() => onSetIdle(a.public_url)}
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

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border"
      style={{ backgroundColor: "var(--eyeframe-topbar)", borderColor: isIdle ? "var(--eyeframe-accent)" : "var(--eyeframe-border)" }}
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
              title={isIdle ? "Current idle image" : "Set as idle image"}
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
