import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { saveStrategy, emptySevenPart } from "@/lib/narrative.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

export const Route = createFileRoute("/_authenticated/narrative/strategy/new")({
  head: () => ({ meta: [{ title: "New strategy — GDPVision" }, { name: "robots", content: "noindex" }] }),
  component: NewStrategy,
});

const PARTS: { key: keyof ReturnType<typeof emptySevenPart>; label: string; hint: string }[] = [
  { key: "situation", label: "Situation", hint: "The undisputed context." },
  { key: "complication", label: "Complication", hint: "The change or tension." },
  { key: "question", label: "Question", hint: "What must be decided." },
  { key: "answer", label: "Answer", hint: "The recommended position." },
  { key: "grounds", label: "Grounds", hint: "Ledger figures + verified positions." },
  { key: "warrant", label: "Warrant", hint: "Why grounds justify the answer." },
  { key: "call", label: "Call", hint: "What is asked of the audience." },
];

function NewStrategy() {
  const navigate = useNavigate();
  const save = useServerFn(saveStrategy);
  const [scope, setScope] = useState("LCA");
  const [sector, setSector] = useState("macro");
  const [title, setTitle] = useState("");
  const [parts, setParts] = useState(emptySevenPart());

  const m = useMutation({
    mutationFn: () => save({ data: { scopeKey: scope, sectorCode: sector, title, sevenPart: parts, sources: [], status: "draft" } }),
    onSuccess: () => navigate({ to: "/narrative/strategy" }),
  });

  return (
    <main className="mx-auto max-w-4xl px-8 py-16">
      <SectionHeader eyebrow={`${scope} · Composer`} title="New strategy statement" />
      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        className="mt-12 space-y-8"
      >
        <div className="grid grid-cols-[1fr_1fr_2fr] gap-4">
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-widest text-ink-500">Scope</span>
            <input value={scope} onChange={(e) => setScope(e.target.value.toUpperCase())} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono" />
          </label>
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-widest text-ink-500">Sector</span>
            <input value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono" />
          </label>
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-widest text-ink-500">Title</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2" />
          </label>
        </div>

        {PARTS.map((p) => (
          <label key={p.key} className="block">
            <span className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xs text-ink-500">{p.hint}</span>
            </span>
            <textarea
              rows={3}
              value={parts[p.key]}
              onChange={(e) => setParts((s) => ({ ...s, [p.key]: e.target.value }))}
              className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 text-sm"
            />
          </label>
        ))}

        {m.error && <p className="text-sm text-red-600">{(m.error as Error).message}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate({ to: "/narrative/strategy" })} className="border border-line-200 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={m.isPending} className="bg-ink-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {m.isPending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
    </main>
  );
}
