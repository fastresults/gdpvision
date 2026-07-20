import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Layers, Sparkles, Trash2, Users, Wand2, RefreshCw, X, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

type AutoState =
  | { kind: "idle" }
  | { kind: "proposing" }
  | { kind: "casting"; index: number; total: number; label: string }
  | { kind: "advancing"; countdown: number }
  | { kind: "complete" }
  | { kind: "paused"; reason?: string }
  | { kind: "error"; message: string };

const AUTORUN_CONSUMED_KEY = (code: string) => `stage02:autorun-consumed:${code}`;

function SegmentsPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
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

  // ── Auto-run state machine ────────────────────────────────────────
  const [auto, setAuto] = useState<AutoState>({ kind: "idle" });
  const cancelRef = useRef(false);
  const autoStartedRef = useRef(false);

  const compose = useMutation({
    mutationFn: () => composeSegments({ data: { countryCode: code, count: 3 } }),
  });

  const gen = useMutation({
    mutationFn: (input: { prompt: string; size: number; visibility: "public" | "private" }) =>
      generateSegment({ data: { countryCode: code, ...input } }),
    onSuccess: (row) => {
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

  const cancelAuto = useCallback((reason?: string) => {
    cancelRef.current = true;
    setAuto({ kind: "paused", reason });
  }, []);

  const castOne = useCallback(
    async (p: SegmentProposal) => {
      await gen.mutateAsync({ prompt: p.prompt, size: p.size, visibility: "public" });
      setProposals((prev) => prev.filter((x) => x.label !== p.label));
    },
    [gen],
  );

  // Master auto-run loop: propose → cast all → advance
  const runAuto = useCallback(async () => {
    cancelRef.current = false;
    try {
      setAuto({ kind: "proposing" });
      const r = await compose.mutateAsync();
      if (cancelRef.current) return;
      if (!r.ok) {
        setComposeError(r.reason);
        setAuto({ kind: "error", message: r.reason });
        return;
      }
      setProposals(r.proposals);
      setDismissed(new Set());
      setComposeError(null);

      const list = r.proposals;
      for (let i = 0; i < list.length; i++) {
        if (cancelRef.current) return;
        const p = list[i];
        setAuto({ kind: "casting", index: i, total: list.length, label: p.label });
        try {
          await castOne(p);
        } catch (e) {
          cancelAuto(`Casting paused on "${p.label}" — ${(e as Error).message}`);
          return;
        }
      }
      if (cancelRef.current) return;

      // Countdown → advance
      let n = 3;
      setAuto({ kind: "advancing", countdown: n });
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (cancelRef.current) return resolve();
          n -= 1;
          if (n <= 0) return resolve();
          setAuto({ kind: "advancing", countdown: n });
          setTimeout(tick, 1000);
        };
        setTimeout(tick, 1000);
      });
      if (cancelRef.current) return;

      try {
        window.localStorage.setItem(AUTORUN_CONSUMED_KEY(code), "1");
      } catch {
        /* ignore storage errors */
      }
      setAuto({ kind: "complete" });
      navigate({ to: "/admin/countries/$code/personas/studies", params: { code }, search: { auto: 1 } });
    } catch (e) {
      setAuto({ kind: "error", message: (e as Error).message });
    }
  }, [castOne, cancelAuto, code, compose, navigate]);

  // Auto-fire on mount when eligible
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (personasQ.isLoading) return;
    if (personaCount === 0) return;
    if (segments.length > 0) return;
    let consumed = false;
    try {
      consumed = window.localStorage.getItem(AUTORUN_CONSUMED_KEY(code)) === "1";
    } catch {
      /* ignore */
    }
    if (consumed) return;
    autoStartedRef.current = true;
    void runAuto();
  }, [code, personaCount, personasQ.isLoading, segments.length, runAuto]);

  async function acceptProposal(p: SegmentProposal) {
    cancelAuto(); // user takes over
    await castOne(p);
  }

  async function acceptAll() {
    cancelAuto();
    const list = proposals.filter((pp) => !dismissed.has(pp.label));
    for (const p of list) {
      // eslint-disable-next-line no-await-in-loop
      await castOne(p);
    }
  }

  const visibleProposals = proposals.filter((p) => !dismissed.has(p.label));
  const autoActive = auto.kind === "proposing" || auto.kind === "casting" || auto.kind === "advancing";

  function regenerate() {
    cancelRef.current = true;
    autoStartedRef.current = true;
    try {
      window.localStorage.removeItem(AUTORUN_CONSUMED_KEY(code));
    } catch {
      /* ignore */
    }
    setProposals([]);
    setDismissed(new Set());
    void runAuto();
  }

  const consumed =
    typeof window !== "undefined" &&
    (() => {
      try {
        return window.localStorage.getItem(AUTORUN_CONSUMED_KEY(code)) === "1";
      } catch {
        return false;
      }
    })();

  const autoLabel =
    auto.kind === "proposing"
      ? "AUTO · drafting…"
      : auto.kind === "casting"
        ? `AUTO · casting ${auto.index + 1}/${auto.total}`
        : auto.kind === "advancing"
          ? `AUTO · advancing ${auto.countdown}s`
          : auto.kind === "paused"
            ? "AUTO · paused"
            : auto.kind === "error"
              ? "AUTO · failed"
              : auto.kind === "complete"
                ? "AUTO · done"
                : segments.length > 0 || consumed
                  ? "AUTO · idle"
                  : "AUTO · ready";

  function AutoRunPrimary({ className = "" }: { className?: string }) {
    if (autoActive) {
      return (
        <button
          type="button"
          onClick={() => cancelAuto("Canceled — resume manually below.")}
          className={`inline-flex items-center gap-1.5 border border-ink-950 bg-paper-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:bg-paper-100 ${className}`}
        >
          <Pause size={12} /> Cancel Auto-run
        </button>
      );
    }
    if (auto.kind === "paused" || auto.kind === "error") {
      return (
        <button
          type="button"
          onClick={regenerate}
          disabled={personaCount === 0}
          className={`inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40 ${className}`}
        >
          <Play size={12} /> Resume Auto-run
        </button>
      );
    }
    const label =
      auto.kind === "complete" || segments.length > 0 || consumed
        ? "Run Auto-run again"
        : "Start Auto-run";
    return (
      <button
        type="button"
        onClick={regenerate}
        disabled={personaCount === 0 || compose.isPending}
        title={
          personaCount === 0
            ? "Cast personas in Stage 01 first"
            : "AI drafts segments, casts each, and advances to Rehearse"
        }
        className={`inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40 ${className}`}
      >
        <Play size={12} /> {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <StudioStepper code={code} active="group" autoStatus={autoLabel} />
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

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Stage 02 · Group your public
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">
            AI proposes the segments. Auto-run casts them.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            A segment is a coherent audience — the kind of group a Cabinet can actually act on.
            Press{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-950">
              Start Auto-run
            </span>{" "}
            and the AI drafts a divergent set grounded in {code}, casts each in sequence, and hands
            off to Rehearse.
          </p>
          {(segments.length > 0 || consumed) && auto.kind === "idle" && personaCount > 0 && (
            <p className="mt-2 text-[12px] italic text-ink-500">
              Auto-run already handed off once. Press Start Auto-run to draft a fresh set and cast them.
            </p>
          )}
        </div>
        <AutoRunPrimary className="shrink-0" />
      </header>

      {/* Auto-run banner */}
      {personaCount > 0 && (autoActive || auto.kind === "paused" || auto.kind === "error" || auto.kind === "complete") && (
        <div
          className={`flex flex-col gap-2 border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
            auto.kind === "error"
              ? "border-rose-500/60 bg-rose-50/60"
              : auto.kind === "paused"
                ? "border-amber-500/60 bg-amber-50/60"
                : auto.kind === "complete"
                  ? "border-emerald-500/60 bg-emerald-50/60"
                  : "border-ink-950/60 bg-paper-100"
          }`}
        >
          <p className="flex items-center gap-2 text-[13px] text-ink-950">
            <Sparkles size={14} className={autoActive ? "animate-pulse text-ink-950" : "text-ink-500"} />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              Auto-run
            </span>
            <span>
              {auto.kind === "proposing" && "Drafting segment proposals from brief + personas…"}
              {auto.kind === "casting" &&
                `Casting ${auto.index + 1} of ${auto.total} · “${auto.label}”…`}
              {auto.kind === "advancing" &&
                `Ready · advancing to Rehearse in ${auto.countdown}s`}
              {auto.kind === "complete" && "Handed off to Rehearse."}
              {auto.kind === "paused" && (auto.reason ?? "Paused — take over below.")}
              {auto.kind === "error" && `Failed: ${auto.message}`}
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {autoActive && (
              <button
                type="button"
                onClick={() => cancelAuto("Canceled — resume manually below.")}
                className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
              >
                <Pause size={11} /> Cancel Auto-run
              </button>
            )}
            {auto.kind === "advancing" && (
              <button
                type="button"
                onClick={() => cancelAuto("Stayed here — Rehearse is one click away.")}
                className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
              >
                Stay here
              </button>
            )}
            {(auto.kind === "paused" || auto.kind === "error") && (
              <button
                type="button"
                onClick={regenerate}
                className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-0 hover:bg-ink-700"
              >
                <Play size={11} /> Resume Auto-run
              </button>
            )}
          </div>
        </div>
      )}

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
                onClick={() => {
                  setProposals([]);
                  setDismissed(new Set());
                  setComposeError(null);
                  compose
                    .mutateAsync()
                    .then((r) => {
                      if (r.ok) setProposals(r.proposals);
                      else setComposeError(r.reason);
                    })
                    .catch((e) => setComposeError((e as Error).message));
                }}
                disabled={compose.isPending || autoActive}
                title="Draft proposals without casting or advancing"
                className="inline-flex items-center gap-1.5 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-40"
              >
                <RefreshCw size={11} className={compose.isPending ? "animate-spin" : ""} />
                {compose.isPending ? "Drafting…" : "Draft only"}
              </button>
              <AutoRunPrimary />
              {visibleProposals.length > 1 && !autoActive && (
                <button
                  type="button"
                  onClick={acceptAll}
                  disabled={gen.isPending}
                  className="inline-flex items-center gap-1.5 border border-ink-950 bg-paper-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:bg-paper-100 disabled:opacity-40"
                >
                  <Sparkles size={11} />
                  {gen.isPending ? "Accepting…" : `Accept all (${visibleProposals.length})`}
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
          {!compose.isPending && visibleProposals.length === 0 && !composeError && !autoActive && (
            <div className="p-6 text-center text-[12px] text-ink-500">
              Press{" "}
              <span className="font-mono uppercase tracking-[0.16em] text-ink-950">
                Start Auto-run
              </span>{" "}
              above to draft and cast segments, or{" "}
              <span className="font-mono uppercase tracking-[0.16em] text-ink-950">Draft only</span>{" "}
              to preview proposals without casting.
            </div>
          )}

          <ul className="divide-y divide-line-200">
            {visibleProposals.map((p, i) => {
              const isCurrent = auto.kind === "casting" && auto.label === p.label;
              return (
                <li key={p.label} className={`p-4 ${isCurrent ? "bg-paper-100" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base text-ink-950">
                        {p.label}
                        {isCurrent && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                            · casting…
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-700">{p.prompt}</p>
                      {p.rationale && (
                        <p className="mt-1.5 text-[11px] italic text-ink-500">{p.rationale}</p>
                      )}
                      {p.evidence.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {p.evidence.map((e, j) => (
                            <li
                              key={`${i}-${j}`}
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
                    {!autoActive && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => acceptProposal(p)}
                          disabled={gen.isPending}
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
                    )}
                  </div>
                </li>
              );
            })}
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
              onClick={() => {
                cancelAuto();
                gen.mutate({ prompt: prompt.trim(), size, visibility });
                setPrompt("");
              }}
              disabled={prompt.trim().length < 3 || gen.isPending}
              className="ml-auto inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              <Sparkles size={12} /> {gen.isPending ? "Generating…" : "Generate segment"}
            </button>
          </div>
          {gen.isError && <p className="mt-2 text-[11px] text-rose-600">{(gen.error as Error).message}</p>}
        </div>
      </details>

      {lastCreated && auto.kind !== "advancing" && auto.kind !== "complete" && (
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
