import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getStrategy, saveStrategy, emptySevenPart } from "@/lib/narrative.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CitationsRail } from "@/components/narrative/CitationsRail";

const PARTS: { key: keyof ReturnType<typeof emptySevenPart>; label: string; hint: string }[] = [
  { key: "situation", label: "Situation", hint: "The undisputed context." },
  { key: "complication", label: "Complication", hint: "The change or tension." },
  { key: "question", label: "Question", hint: "What must be decided." },
  { key: "answer", label: "Answer", hint: "The recommended position." },
  { key: "grounds", label: "Grounds", hint: "Ledger figures + verified positions." },
  { key: "warrant", label: "Warrant", hint: "Why grounds justify the answer." },
  { key: "call", label: "Call", hint: "What is asked of the audience." },
];

const STATUSES = ["draft", "review", "adopted", "archived"] as const;

function strategyQuery(id: string) {
  return queryOptions({ queryKey: ["strategy", id], queryFn: () => getStrategy({ data: { id } }) });
}

export const Route = createFileRoute("/_authenticated/narrative/strategy/$id")({
  head: () => ({ meta: [{ title: "Edit strategy — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(strategyQuery(params.id)),
  component: EditStrategy,
});

function EditStrategy() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const save = useServerFn(saveStrategy);
  const { data } = useSuspenseQuery(strategyQuery(id));

  const initialParts = { ...emptySevenPart(), ...(data.seven_part as Record<string, string> | null ?? {}) };
  const initialSources = Array.isArray(data.sources) ? (data.sources as Array<{ label: string; ref: string }>) : [];
  const [title, setTitle] = useState(data.title);
  const [sector, setSector] = useState(data.sector_code);
  const [parts, setParts] = useState(initialParts);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(data.status as (typeof STATUSES)[number]);
  const [sources, setSources] = useState<Array<{ label: string; ref: string }>>(initialSources);

  const m = useMutation({
    mutationFn: () => save({ data: { id, scopeKey: data.scope_key, sectorCode: sector, title, sevenPart: parts, sources, status } }),
    onSuccess: () => navigate({ to: "/narrative/strategy" }),
  });

  const combinedBody = PARTS.map((p) => `${p.label}: ${parts[p.key] ?? ""}`).join("\n\n");

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-[1fr_320px] gap-12 px-8 py-16">
      <div>
        <SectionHeader eyebrow={`${data.scope_key} · v${data.version} → v${data.version + 1}`} title="Edit strategy" />
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="mt-12 space-y-8">
          <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 text-sm">
            <label>
              <span className="block text-xs uppercase tracking-widest text-ink-500">Sector</span>
              <input value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono" />
            </label>
            <label>
              <span className="block text-xs uppercase tracking-widest text-ink-500">Title</span>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2" />
            </label>
            <label>
              <span className="block text-xs uppercase tracking-widest text-ink-500">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {PARTS.map((p) => (
            <label key={p.key} className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs text-ink-500">{p.hint}</span>
              </span>
              <textarea rows={3} value={parts[p.key] ?? ""} onChange={(e) => setParts((s) => ({ ...s, [p.key]: e.target.value }))} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 text-sm" />
            </label>
          ))}

          {m.error && <p className="text-sm text-red-600">{(m.error as Error).message}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate({ to: "/narrative/strategy" })} className="border border-line-200 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={m.isPending} className="bg-ink-900 px-4 py-2 text-sm text-white disabled:opacity-50">
              {m.isPending ? "Saving…" : "Save new version"}
            </button>
          </div>
        </form>
      </div>

      <CitationsRail
        scopeKey={data.scope_key}
        sectorCode={sector}
        sources={sources}
        onAttach={(s) => setSources((prev) => (prev.some((p) => p.ref === s.ref) ? prev : [...prev, s]))}
        onRemove={(ref) => setSources((prev) => prev.filter((p) => p.ref !== ref))}
        body={combinedBody}
        showFactCheck
      />
    </main>
  );
}
