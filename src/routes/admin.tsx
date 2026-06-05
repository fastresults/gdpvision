import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import {
  createItem,
  deleteItem,
  listItems,
  moveItem,
  updateItem,
  type Item,
  type ItemCategory,
} from "@/lib/items.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "EyeFrame — Admin" },
      { name: "description", content: "Manage EyeFrame kiosk resources." },
    ],
  }),
  component: AdminPage,
});

const TABS: { key: ItemCategory; label: string }[] = [
  { key: "websites", label: "Websites" },
  { key: "presentations", label: "Presentations" },
  { key: "docs", label: "Google Docs" },
];

function AdminPage() {
  const qc = useQueryClient();
  const fetchItems = useServerFn(listItems);
  const create = useServerFn(createItem);
  const update = useServerFn(updateItem);
  const remove = useServerFn(deleteItem);
  const move = useServerFn(moveItem);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });

  const [tab, setTab] = useState<ItemCategory>("websites");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const visible = useMemo(
    () =>
      items
        .filter((i) => i.category === tab)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items, tab],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["items"] });

  const createMut = useMutation({
    mutationFn: () => create({ data: { category: tab, label, url } }),
    onSuccess: () => {
      setLabel("");
      setUrl("");
      invalidate();
    },
  });

  const updateMut = useMutation({
    mutationFn: (item: Item) =>
      update({ data: { id: item.id, label: editLabel, url: editUrl, favicon_url: item.favicon_url } }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });

  const moveMut = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      move({ data: { id, direction } }),
    onSuccess: invalidate,
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
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6" style={{ color: "var(--eyeframe-accent)" }} />
            <h1 className="text-2xl font-semibold tracking-tight">EyeFrame Admin</h1>
          </div>
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
        </header>

        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: tab === t.key ? "var(--eyeframe-accent)" : "var(--eyeframe-card)",
                color: tab === t.key ? "var(--eyeframe-bg)" : "var(--eyeframe-text)",
                borderColor: tab === t.key ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Add form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim() || !url.trim()) return;
            createMut.mutate();
          }}
          className="mb-8 rounded-lg border p-4"
          style={{
            backgroundColor: "var(--eyeframe-topbar)",
            borderColor: "var(--eyeframe-border)",
          }}
        >
          <div className="mb-3 text-sm font-medium opacity-80">Add to {TABS.find((t) => t.key === tab)?.label}</div>
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
            <button
              type="submit"
              disabled={createMut.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: "var(--eyeframe-accent)", color: "var(--eyeframe-bg)" }}
            >
              <Plus className="h-4 w-4" />
              Add
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
                {item.favicon_url ? (
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
      </div>
    </div>
  );
}
