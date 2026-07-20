import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowRight, Layers, Sparkles, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { deleteSegment, generateSegment, listSegments } from "@/lib/personas/generate.functions";

function segmentsQuery(code: string) {
  return queryOptions({
    queryKey: ["persona-segments", code],
    queryFn: () => listSegments({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/segments")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(segmentsQuery(params.code)),
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: SegmentsPage,
});

function SegmentsPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const { data: segments } = useSuspenseQuery(segmentsQuery(code));
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(8);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [lastCreated, setLastCreated] = useState<{ id: string; label: string } | null>(null);

  const gen = useMutation({
    mutationFn: () => generateSegment({ data: { countryCode: code, prompt: prompt.trim(), size, visibility } }),
    onSuccess: (row) => {
      setPrompt("");
      setLastCreated({ id: row.segment.id, label: row.segment.label });
      qc.invalidateQueries({ queryKey: ["persona-segments", code] });
      qc.invalidateQueries({ queryKey: ["personas", code] });
    },

  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSegment({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persona-segments", code] });
      qc.invalidateQueries({ queryKey: ["personas", code] });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage 02 · Group your public
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">Build a population, in plain English</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          A segment is a coherent audience — the kind of group a Cabinet can actually act on. Describe who
          you want to hear from and we&rsquo;ll draft a divergent set of personas grounded in {code}.
        </p>
      </header>

      {segments.length === 0 && !gen.isPending && !lastCreated && (
        <div className="grid place-items-center border border-dashed border-line-200 bg-paper-0 p-8 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid h-12 w-12 place-items-center border border-line-200 text-ink-950">
              <Users size={20} />
            </span>
            <h3 className="mt-3 font-serif text-xl text-ink-950">Draft your first segment</h3>
            <p className="mt-1 text-sm text-ink-500">
              Start with a plain-English description below — e.g. &ldquo;small-business owners in tourism, urban
              and rural, mixed income, aged 30–60.&rdquo;
            </p>
          </div>
        </div>
      )}

      <section className="border border-line-200 bg-paper-0 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-ink-950 bg-paper-0 font-mono text-[11px] text-ink-950">
            01
          </span>
          <h3 className="font-serif text-lg text-ink-950">Describe the audience</h3>
        </div>
        <p className="mb-3 text-[12px] leading-snug text-ink-500">
          The prompt shapes who joins the room. <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-700">Size</span>{" "}
          controls how divergent the set is — higher size = wider spread of views.
        </p>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Segment prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Small-business owners in tourism, split urban/rural, mixed income, aged 30-60"
            className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-sm focus:border-ink-950 focus:outline-none"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            Size:
            <input
              type="number"
              min={3}
              max={20}
              value={size}
              onChange={(e) => setSize(Math.max(3, Math.min(20, Number(e.target.value) || 8)))}
              className="w-14 border border-line-200 bg-paper-0 px-1 py-0.5 text-right"
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Public
          </label>
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            <input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /> Private
          </label>
          <button
            type="button"
            onClick={() => gen.mutate()}
            disabled={prompt.trim().length < 3 || gen.isPending}
            className="ml-auto inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
          >
            <Sparkles size={12} /> {gen.isPending ? "Generating…" : "Generate segment"}
          </button>
        </div>
        {gen.isError && <p className="mt-2 text-[11px] text-rose-600">{(gen.error as Error).message}</p>}
      </section>

      {lastCreated && (
        <div className="flex flex-col gap-2 border border-emerald-600 bg-emerald-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-950">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700">
              Segment ready
            </span>{" "}
            · &ldquo;{lastCreated.label}&rdquo; is in your library.
          </p>
          <Link
            to="/admin/countries/$code/personas/studies"
            params={{ code }}
            search={{ segmentId: lastCreated.id }}
            className="inline-flex shrink-0 items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
          >
            Design a study with this segment <ArrowRight size={12} />
          </Link>
        </div>
      )}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Segments · {segments.length}
        </p>
        {segments.length === 0 ? (
          <div className="mt-2 border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
            No segments yet.
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line-200 border border-line-200 bg-paper-0">
            {segments.map((s) => (
              <li key={s.id} className="group flex items-start gap-3 p-3">
                <Layers size={16} className="mt-0.5 text-ink-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base text-ink-950">{s.label}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {s.size} personas · {s.visibility} · {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 truncate text-[12px] text-ink-700">{s.prompt}</p>
                </div>
                <Link
                  to="/admin/countries/$code/personas/studies"
                  params={{ code }}
                  search={{ segmentId: s.id }}
                  className="border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
                >
                  Study →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete segment "${s.label}"?`)) del.mutate(s.id);
                  }}
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={14} className="text-ink-500 hover:text-rose-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
