import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Lock } from "lucide-react";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  moveCategory,
  CATEGORY_ICON_NAMES,
  type CategoryBehavior,
} from "@/lib/categories.functions";
import { getCategoryIcon, type MediaMode } from "@/lib/kiosk-types";

const BEHAVIORS: { value: CategoryBehavior; label: string; hint: string }[] = [
  { value: "website", label: "Website", hint: "Loads URL in iframe" },
  { value: "pdf", label: "PDF", hint: "Uploaded PDF file" },
  { value: "docs", label: "Google Docs", hint: "Doc link in iframe" },
  { value: "video", label: "Video", hint: "Uploaded video file" },
  { value: "gallery", label: "Gallery", hint: "Collections of videos and/or images" },
];

export default function CategoryManager() {
  const qc = useQueryClient();
  const fetchCats = useServerFn(listCategories);
  const createFn = useServerFn(createCategory);
  const updateFn = useServerFn(updateCategory);
  const deleteFn = useServerFn(deleteCategory);
  const moveFn = useServerFn(moveCategory);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCats(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<string>("Globe");
  const [behavior, setBehavior] = useState<CategoryBehavior>("website");
  const [err, setErr] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { label: label.trim(), icon, behavior } }),
    onSuccess: () => {
      setLabel("");
      setIcon("Globe");
      setBehavior("website");
      setErr(null);
      invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; label?: string; icon?: string }) =>
      updateFn({ data: v }),
    onSuccess: invalidate,
  });

  const moveMut = useMutation({
    mutationFn: (v: { id: string; direction: "up" | "down" }) =>
      moveFn({ data: v }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      setErr(null);
      invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div
      className="mb-6 rounded-lg border p-4"
      style={{
        backgroundColor: "var(--eyeframe-topbar)",
        borderColor: "var(--eyeframe-border)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Navigation categories</h2>
          <p className="text-xs opacity-60">
            These appear in the kiosk top-bar dropdown. Pick a behavior to control how items render.
          </p>
        </div>
      </div>

      {/* Add new */}
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_160px_auto]">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="New category label"
          className="rounded-md border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--eyeframe-card)",
            borderColor: "var(--eyeframe-border)",
            color: "var(--eyeframe-text)",
          }}
        />
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--eyeframe-card)",
            borderColor: "var(--eyeframe-border)",
            color: "var(--eyeframe-text)",
          }}
        >
          {CATEGORY_ICON_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={behavior}
          onChange={(e) => setBehavior(e.target.value as CategoryBehavior)}
          className="rounded-md border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--eyeframe-card)",
            borderColor: "var(--eyeframe-border)",
            color: "var(--eyeframe-text)",
          }}
        >
          {BEHAVIORS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label} — {b.hint}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={!label.trim() || createMut.isPending}
          className="flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{
            backgroundColor: "var(--eyeframe-accent)",
            color: "var(--eyeframe-bg)",
          }}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--eyeframe-border)", color: "tomato" }}>
          {err}
        </div>
      )}

      {/* Existing list */}
      <div className="flex flex-col gap-1">
        {cats.map((c, idx) => {
          const Icon = getCategoryIcon(c.icon);
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--eyeframe-card)",
                borderColor: "var(--eyeframe-border)",
              }}
            >
              <Icon className="h-4 w-4 opacity-80" />
              <input
                value={c.label}
                onChange={(e) =>
                  qc.setQueryData(["categories"], (prev: typeof cats | undefined) =>
                    (prev ?? []).map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)),
                  )
                }
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.label) updateMut.mutate({ id: c.id, label: v });
                }}
                className="flex-1 rounded-md border bg-transparent px-2 py-1 text-sm outline-none"
                style={{ borderColor: "transparent", color: "var(--eyeframe-text)" }}
              />
              <select
                value={c.icon}
                onChange={(e) => updateMut.mutate({ id: c.id, icon: e.target.value })}
                className="rounded-md border px-2 py-1 text-xs outline-none"
                style={{
                  backgroundColor: "var(--eyeframe-topbar)",
                  borderColor: "var(--eyeframe-border)",
                  color: "var(--eyeframe-text)",
                }}
              >
                {CATEGORY_ICON_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span
                className="rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-70"
                style={{ borderColor: "var(--eyeframe-border)" }}
                title={`Behavior: ${c.behavior} (cannot be changed)`}
              >
                {c.behavior}
              </span>
              <button
                type="button"
                onClick={() => moveMut.mutate({ id: c.id, direction: "up" })}
                disabled={idx === 0 || moveMut.isPending}
                className="rounded-md border p-1 transition-colors hover:brightness-125 disabled:opacity-30"
                style={{ borderColor: "var(--eyeframe-border)" }}
                title="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveMut.mutate({ id: c.id, direction: "down" })}
                disabled={idx === cats.length - 1 || moveMut.isPending}
                className="rounded-md border p-1 transition-colors hover:brightness-125 disabled:opacity-30"
                style={{ borderColor: "var(--eyeframe-border)" }}
                title="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              {c.is_builtin ? (
                <span
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] opacity-60"
                  style={{ borderColor: "var(--eyeframe-border)" }}
                  title="Built-in category — cannot be deleted"
                >
                  <Lock className="h-3 w-3" /> Built-in
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete category "${c.label}"?`)) deleteMut.mutate(c.id);
                  }}
                  className="rounded-md border p-1 transition-colors hover:brightness-125"
                  style={{ borderColor: "var(--eyeframe-border)", color: "tomato" }}
                  title="Delete category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
