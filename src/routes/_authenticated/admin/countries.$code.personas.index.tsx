import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Trash2, User } from "lucide-react";
import { useState } from "react";

import { deletePersona, generatePersona, listPersonas } from "@/lib/personas/generate.functions";

function personasQuery(code: string) {
  return queryOptions({
    queryKey: ["personas", code],
    queryFn: () => listPersonas({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/")({
  loader: async ({ context, params }) => context.queryClient.ensureQueryData(personasQuery(params.code)),
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: PersonasIndex,
});

function PersonasIndex() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const { data: personas } = useSuspenseQuery(personasQuery(code));
  const [brief, setBrief] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const gen = useMutation({
    mutationFn: () => generatePersona({ data: { countryCode: code, brief: brief.trim(), visibility } }),
    onSuccess: () => {
      setBrief("");
      qc.invalidateQueries({ queryKey: ["personas", code] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deletePersona({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personas", code] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Persona Studio</p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">Generate a synthetic persona</h2>
        <p className="mt-1 text-sm text-ink-500">
          Grounded in {code}&rsquo;s sectors, KPIs, ministries, and recent signals.
        </p>
      </header>

      <div className="border border-line-200 bg-paper-0 p-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Brief</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="e.g. A European HNWI considering CBI in the Caribbean"
            className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-sm focus:border-ink-950 focus:outline-none"
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Public
          </label>
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            <input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /> Private
          </label>
          <button
            type="button"
            onClick={() => gen.mutate()}
            disabled={brief.trim().length < 3 || gen.isPending}
            className="ml-auto inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
          >
            <Sparkles size={12} /> {gen.isPending ? "Generating…" : "Generate persona"}
          </button>
        </div>
        {gen.isError && <p className="mt-2 text-[11px] text-rose-600">{(gen.error as Error).message}</p>}
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Library · {personas.length} personas
        </p>
        {personas.length === 0 ? (
          <div className="mt-2 border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
            No personas yet — generate your first one above.
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {personas.map((p) => (
              <div key={p.id} className="group relative border border-line-200 bg-paper-0 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center border border-line-200 text-ink-950">
                    <User size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/admin/countries/$code/personas/$id"
                      params={{ code, id: p.id }}
                      className="block truncate font-serif text-base text-ink-950 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.14em] text-ink-500">
                      {p.archetype ?? "—"} · {p.visibility}
                    </p>
                    {p.summary && (
                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-700">{p.summary}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete ${p.name}?`)) del.mutate(p.id);
                    }}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} className="text-ink-500 hover:text-rose-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
