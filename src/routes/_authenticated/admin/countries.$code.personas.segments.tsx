import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Layers, Sparkles, Trash2, Users, Wand2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { deleteSegment, generateSegment, listPersonas, listSegments } from "@/lib/personas/generate.functions";
import { composeSegments, type SegmentProposal } from "@/lib/personas/compose-segments.functions";
import { StudioStepper } from "@/components/personas/StudioStepper";

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
  const personasQ = useQuery({
    queryKey: ["personas", code],
    queryFn: () => listPersonas({ data: { countryCode: code } }),
  });
  const personaCount = personasQ.data?.length ?? 0;
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(8);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [lastCreated, setLastCreated] = useState<{ id: string; label: string } | null>(null);

  // ── AI-first proposals ─────────────────────────────────────────────
  const [proposals, setProposals] = useState<SegmentProposal[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [composeError, setComposeError] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);

  const compose = useMutation({
    mutationFn: () => composeSegments({ data: { countryCode: code, count: 3 } }),
    onSuccess: (r) => {
      if (r.ok) {
        setProposals(r.proposals);
        setDismissed(new Set());
        setComposeError(null);
      } else {
        setComposeError(r.reason);
      }
    },
    onError: (e) => setComposeError((e as Error).message),
  });

  // Auto-fire on mount when we can (personas exist, no segments yet, nothing proposed)
  useEffect(() => {
    if (
      personaCount > 0 &&
      segments.length === 0 &&
      proposals.length === 0 &&
      !compose.isPending &&
      !composeError
    ) {
      compose.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaCount, segments.length]);

  const gen = useMutation({
    mutationFn: (input: { prompt: string; size: number; visibility: "public" | "private" }) =>
      generateSegment({ data: { countryCode: code, ...input } }),
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

  async function acceptProposal(p: SegmentProposal) {
    await gen.mutateAsync({ prompt: p.prompt, size: p.size, visibility: "public" });
    setProposals((prev) => prev.filter((x) => x.label !== p.label));
  }

  async function acceptAll() {
    setAcceptingAll(true);
    try {
      const list = proposals.filter((p) => !dismissed.has(p.label));
      for (const p of list) {
        // sequential to avoid rate limits
        // eslint-disable-next-line no-await-in-loop
        await gen.mutateAsync({ prompt: p.prompt, size: p.size, visibility: "public" });
      }
      setProposals([]);
    } finally {
      setAcceptingAll(false);
    }
  }

  const visibleProposals = proposals.filter((p) => !dismissed.has(p.label));

  return (
    <div className="space-y-6">
      <StudioStepper code={code} active="group" />
      {personaCount === 0 && (
        <div className="flex flex-col gap-2 border border-amber-500/60 bg-amber-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-950">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700">
              Cast a public first
            </span>{" "}
            · Segments group personas that already exist in your studio.
          </p>
          <Link
            to="/admin/countries/$code/personas"
            params={{ code }}
            className="inline-flex shrink-0 items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
          >
            Back to Stage 01 · Cast <ArrowRight size={12} />
          </Link>
        </div>
      )}

      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage 02 · Group your public
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">
          AI proposes the segments. You ratify.
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          A segment is a coherent audience — the kind of group a Cabinet can actually act on. From
          your brief and existing personas, the AI drafts a divergent set grounded in {code}.
        </p>
      </header>

      {/* AI-first proposals panel */}
      {personaCount > 0 && (
        <section className="border border-ink-950/40 bg-paper-0">
          <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Wand2 size={14} className="text-ink-950" />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950">
                AI segment proposals
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => compose.mutate()}
                disabled={compose.isPending}
                className="inline-flex items-center gap-1.5 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-40"
              >
                <RefreshCw size={11} className={compose.isPending ? "animate-spin" : ""} />
                {compose.isPending ? "Composing…" : proposals.length ? "Regenerate" : "Propose"}
              </button>
              {visibleProposals.length > 1 && (
                <button
                  type="button"
                  onClick={acceptAll}
                  disabled={acceptingAll || gen.isPending}
                  className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
                >
                  <Sparkles size={11} />
                  {acceptingAll ? "Accepting…" : `Accept all (${visibleProposals.length})`}
                </button>
              )}
            </div>
          </div>

          {compose.isPending && proposals.length === 0 && (
            <div className="p-6 text-center text-[12px] text-ink-500">
              Drafting segment proposals from brief + personas…
            </div>
          )}
          {composeError && (
            <div className="border-b border-line-200 bg-rose-50/60 px-4 py-2 text-[11px] text-rose-700">
              {composeError}
            </div>
          )}
          {!compose.isPending && visibleProposals.length === 0 && !composeError && (
            <div className="p-6 text-center text-[12px] text-ink-500">
              No proposals yet — click Propose to have the AI draft segments.
            </div>
          )}

          <ul className="divide-y divide-line-200">
            {visibleProposals.map((p) => (
              <li key={p.label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-base text-ink-950">{p.label}</p>
                    <p className="mt-1 text-[12px] text-ink-700">{p.prompt}</p>
                    {p.rationale && (
                      <p className="mt-1.5 text-[11px] italic text-ink-500">{p.rationale}</p>
                    )}
                    {p.evidence.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {p.evidence.map((e, i) => (
                          <li
                            key={i}
                            className="border border-line-200 bg-paper-100 px-2 py-0.5 text-[10px] text-ink-700"
                            title={e.source}
                          >
                            “{e.quote}”
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      {p.size} personas · public
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => acceptProposal(p)}
                      disabled={gen.isPending || acceptingAll}
                      className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
                    >
                      <Sparkles size={11} /> Accept & cast
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissed((prev) => {
                          const n = new Set(prev);
                          n.add(p.label);
                          return n;
                        })
                      }
                      className="inline-flex items-center gap-1 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 hover:border-ink-950 hover:text-ink-950"
                    >
                      <X size={10} /> Dismiss
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {gen.isError && (
            <div className="border-t border-line-200 bg-rose-50/60 px-4 py-2 text-[11px] text-rose-700">
              {(gen.error as Error).message}
            </div>
          )}
        </section>
      )}

      {/* Manual composer — collapsed by default */}
      <details className="group border border-line-200 bg-paper-0">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          <span>Compose a segment manually</span>
          <span className="text-[10px] text-ink-500 group-open:hidden">Advanced ▾</span>
          <span className="hidden text-[10px] text-ink-500 group-open:inline">Hide ▴</span>
        </summary>
        <div className="border-t border-line-200 p-4">
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
              onClick={() => gen.mutate({ prompt: prompt.trim(), size, visibility })}
              disabled={prompt.trim().length < 3 || gen.isPending}
              className="ml-auto inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              <Sparkles size={12} /> {gen.isPending ? "Generating…" : "Generate segment"}
            </button>
          </div>
          {gen.isError && <p className="mt-2 text-[11px] text-rose-600">{(gen.error as Error).message}</p>}
        </div>
      </details>

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

      {personaCount === 0 && (
        <p className="text-[11px] text-ink-500">
          <Users size={12} className="mr-1 inline align-text-bottom" />
          Cast personas first in Stage 01, then AI will propose segments here automatically.
        </p>
      )}
    </div>
  );
}
