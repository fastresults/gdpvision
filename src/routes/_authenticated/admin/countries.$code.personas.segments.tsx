import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQueryClient,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  ArrowRight,
  Layers,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  RefreshCw,
  X,
  Pause,
  Play,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteSegment,
  generateSegment,
  listPersonas,
  listSegments,
} from "@/lib/personas/generate.functions";
import { composeSegments, type SegmentProposal } from "@/lib/personas/compose-segments.functions";
import { listStudies } from "@/lib/personas/study.functions";
import {
  draftStudiesForSegments,
  completeIncompleteStudies,
  AUTO_STUDIES_LOCK,
  AUTO_STUDIES_FLAG_KEY,
} from "@/lib/personas/study-autorun";
import { StudioStepper } from "@/components/personas/StudioStepper";
import { ProjectSwitcher } from "@/components/personas/StudyWizard/ProjectSwitcher";
import { ProgramsIndex } from "@/components/personas/StudyWizard/ProgramsIndex";
import { clearAutoRun, publishAutoRun, registerAutoRunAbort, registerAutoRunResume, unregisterAutoRunAbort } from "@/lib/autorun/beacon";

function segmentsQuery(code: string, projectId: string) {
  return queryOptions({
    queryKey: ["persona-segments", code, projectId],
    queryFn: () => listSegments({ data: { countryCode: code, projectId } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/segments")({
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  notFoundComponent: () => <p className="p-6 text-sm text-ink-500">Segments not found.</p>,
  component: SegmentsPage,
});

type AutoState =
  | { kind: "idle" }
  | { kind: "proposing" }
  | { kind: "casting"; index: number; total: number; label: string }
  | {
      kind: "drafting_studies";
      index: number;
      total: number;
      label: string;
      drafted: number;
      failed: number;
    }
  | { kind: "advancing"; countdown: number }
  | { kind: "complete" }
  | {
      kind: "paused";
      reason?: string;
      drafted?: number;
      failed?: Array<{ label: string; reason: string }>;
    }
  | { kind: "error"; message: string };

const AUTORUN_CONSUMED_KEY = (code: string, projectId: string) => `stage02:autorun-consumed:${code}:${projectId}`;

function SegmentsPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const openedRef = useRef<Set<string>>(new Set());
  const search = useSearch({ strict: false }) as { auto?: unknown; project?: string; open?: unknown };
  const autoIntent = search.auto === 1 || search.auto === "1" || search.auto === true;
  useEffect(() => {
    if (search.open && search.project) {
      openedRef.current.add(search.project);
      navigate({
        to: "/admin/countries/$code/personas/segments",
        params: { code },
        search: (s: Record<string, unknown>) => ({ ...s, open: undefined }),
        replace: true,
      });
      return;
    }
    if (search.project && !openedRef.current.has(search.project)) {
      navigate({
        to: "/admin/countries/$code/personas/segments",
        params: { code },
        search: {},
        replace: true,
      });
    }
  }, [search.open, search.project, code, navigate]);
  const activeProjectId = search.project && openedRef.current.has(search.project) ? search.project : undefined;
  const { data: segments = [] } = useQuery({
    ...segmentsQuery(code, activeProjectId ?? "none"),
    enabled: !!activeProjectId,
  });
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
    mutationFn: () => {
      if (!activeProjectId) return Promise.resolve({ ok: false as const, reason: "Select or create a research program first." });
      return composeSegments({ data: { countryCode: code, projectId: activeProjectId, count: 3 } });
    },
  });

  const gen = useMutation({
    mutationFn: (input: { prompt: string; size: number; visibility: "public" | "private" }) =>
      activeProjectId
        ? generateSegment({ data: { countryCode: code, projectId: activeProjectId, ...input } })
        : Promise.reject(new Error("Select or create a research program before generating segments.")),
    onSuccess: (row) => {
      setLastCreated({ id: row.segment.id, label: row.segment.label });
      qc.invalidateQueries({ queryKey: ["persona-segments", code, activeProjectId] });
      qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      qc.invalidateQueries({ queryKey: ["personas", code] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteSegment({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persona-segments", code, activeProjectId] });
      qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      qc.invalidateQueries({ queryKey: ["personas", code] });
    },
  });

  const cancelAuto = useCallback((reason?: string) => {
    cancelRef.current = true;
    setAuto({ kind: "paused", reason });
  }, []);

  const castOne = useCallback(
    async (p: SegmentProposal) => {
      if (!activeProjectId) throw new Error("Select or create a research program first.");
      const row = await gen.mutateAsync({ prompt: p.prompt, size: p.size, visibility: "public" });
      setProposals((prev) => prev.filter((x) => x.label !== p.label));
      return row.segment;
    },
    [activeProjectId, gen],
  );

  // Master auto-run loop: propose → cast all → draft studies → advance to Stage 03
  const runAuto = useCallback(async () => {
    cancelRef.current = false;
    const projectId = activeProjectId;
    if (!projectId) {
      setAuto({ kind: "error", message: "Select or create a research program before starting auto-run." });
      return;
    }
    const lockKey = `${code}:${projectId}`;
    if (AUTO_STUDIES_LOCK.has(lockKey)) {
      setAuto({ kind: "error", message: "Auto-run is already active for this country." });
      return;
    }
    AUTO_STUDIES_LOCK.add(lockKey);
    try {
      setAuto({ kind: "proposing" });
      const r = await compose.mutateAsync();
      if (cancelRef.current) {
        AUTO_STUDIES_LOCK.delete(lockKey);
        return;
      }
      if (!r.ok) {
        setComposeError(r.reason);
        setAuto({ kind: "error", message: r.reason });
        AUTO_STUDIES_LOCK.delete(lockKey);
        return;
      }
      setProposals(r.proposals);
      setDismissed(new Set());
      setComposeError(null);

      const list = r.proposals;
      for (let i = 0; i < list.length; i++) {
        if (cancelRef.current) {
          AUTO_STUDIES_LOCK.delete(lockKey);
          return;
        }
        const p = list[i];
        setAuto({ kind: "casting", index: i, total: list.length, label: p.label });
        try {
          await castOne(p);
        } catch (e) {
          AUTO_STUDIES_LOCK.delete(lockKey);
          cancelAuto(`Casting paused on "${p.label}" — ${(e as Error).message}`);
          return;
        }
      }
      if (cancelRef.current) {
        AUTO_STUDIES_LOCK.delete(lockKey);
        return;
      }

      // Refresh the segment and study lists so we draft studies for every
      // segment (including any that existed before this run) without duplication.
      await qc.invalidateQueries({ queryKey: ["persona-segments", code, projectId] });
      await qc.invalidateQueries({ queryKey: ["studies", code, projectId] });
      let freshSegments: Array<{ id: string; label: string }> = [];
      let freshStudies: Array<{ segment_id?: string | null }> = [];
      try {
        freshSegments = (await listSegments({ data: { countryCode: code, projectId } })).map((s) => ({
          id: s.id,
          label: s.label,
        }));
        freshStudies = await listStudies({ data: { countryCode: code, projectId } });
      } catch (e) {
        AUTO_STUDIES_LOCK.delete(lockKey);
        setAuto({
          kind: "error",
          message: `Could not refresh segments/studies: ${(e as Error).message}`,
        });
        return;
      }
      if (cancelRef.current) {
        AUTO_STUDIES_LOCK.delete(lockKey);
        return;
      }

      const coveredIds = new Set(
        freshStudies.map((s) => s.segment_id).filter((v): v is string => !!v),
      );
      const targets = freshSegments.filter((s) => !coveredIds.has(s.id));

      let draftFailures: Array<{ label: string; reason: string }> = [];
      if (targets.length > 0) {
        let lastDrafted = 0;
        let lastFailed = 0;
        const result = await draftStudiesForSegments({
          code,
          projectId,
          targets,
          cancelRef,
          fullPipeline: true,
          onProgress: ({ index, total, segmentLabel }) => {
            setAuto({
              kind: "drafting_studies",
              index: index - 1,
              total,
              label: segmentLabel,
              drafted: lastDrafted,
              failed: lastFailed,
            });
          },
          onOneComplete: () => {
            lastDrafted += 1;
          },
        });
        lastFailed = result.failed.length;
        draftFailures = result.failed.map((f) => ({ label: f.label, reason: f.reason }));

        if (cancelRef.current) {
          AUTO_STUDIES_LOCK.delete(lockKey);
          setAuto({
            kind: "paused",
            reason: "Study drafting canceled — resume to finish.",
            drafted: result.drafted,
            failed: result.failed,
          });
          return;
        }
      }

      // Sweep: always finish anything left incomplete (timed-out runStudy,
      // pre-existing drafts, races). This is what guarantees the user
      // lands on Stage 03 with fully synthesized work product.
      const sweep = await completeIncompleteStudies({
        code,
        projectId,
        cancelRef,
        onProgress: ({ index, total, segmentLabel }) => {
          setAuto({
            kind: "drafting_studies",
            index: Math.max(0, index - 1),
            total,
            label: segmentLabel,
            drafted: 0,
            failed: 0,
          });
        },
      });
      const sweepFailures = sweep.failed.map((f) => ({ label: f.label, reason: f.reason }));
      const allFailures = [...draftFailures, ...sweepFailures];

      if (cancelRef.current) {
        AUTO_STUDIES_LOCK.delete(lockKey);
        return;
      }

      // Verify: nothing is still draft/running before we flag as consumed.
      let unfinished = 0;
      try {
        const finalStudies = await listStudies({ data: { countryCode: code, projectId } });
        unfinished = finalStudies.filter(
          (s) => s.status !== "complete" && s.status !== "synthesized",
        ).length;
      } catch {
        unfinished = 1; // be conservative
      }

      // Countdown → advance to Stage 03 (review mode)
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
      if (cancelRef.current) {
        AUTO_STUDIES_LOCK.delete(lockKey);
        return;
      }

      try {
        window.localStorage.setItem(AUTORUN_CONSUMED_KEY(code, projectId), "1");
        // Only mark studies-autorun as flagged when the pipeline actually
        // finished everything cleanly. Otherwise Stage 03 must be free to
        // self-heal on landing.
        if (allFailures.length === 0 && unfinished === 0) {
          window.localStorage.setItem(AUTO_STUDIES_FLAG_KEY(code, projectId), String(Date.now()));
        } else {
          window.localStorage.removeItem(AUTO_STUDIES_FLAG_KEY(code, projectId));
        }
      } catch {
        /* ignore storage errors */
      }
      AUTO_STUDIES_LOCK.delete(lockKey);
      setAuto({ kind: "complete" });
      navigate({
        to: "/admin/countries/$code/personas/studies",
        params: { code },
        search: { project: projectId, open: 1 },
      });
    } catch (e) {
      if (projectId) AUTO_STUDIES_LOCK.delete(`${code}:${projectId}`);
      setAuto({ kind: "error", message: (e as Error).message });
    }
  }, [activeProjectId, castOne, cancelAuto, code, compose, navigate, qc]);

  // Landing on this page must NEVER start work from URL/search state. Prior
  // versions accepted `?auto=1`, which let stale browser state from an old
  // program restart processing in a new workspace. Strip it and remain idle;
  // the only valid start path is the visible Start Auto-run button.
  useEffect(() => {
    if (!autoIntent) return;
    navigate({
      to: "/admin/countries/$code/personas/segments",
      params: { code },
      search: (s: Record<string, unknown>) => ({ ...s, auto: undefined }),
      replace: true,
    });
  }, [autoIntent, code, navigate]);

  async function acceptProposal(p: SegmentProposal) {
    cancelAuto(); // user takes over
    await castOne(p);
  }

  async function acceptAll() {
    cancelAuto();
    const list = proposals.filter((pp) => !dismissed.has(pp.label));
    for (const p of list) {
      await castOne(p);
    }
  }

  const visibleProposals = proposals.filter((p) => !dismissed.has(p.label));
  const autoActive =
    auto.kind === "proposing" ||
    auto.kind === "casting" ||
    auto.kind === "drafting_studies" ||
    auto.kind === "advancing";

  function regenerate() {
    cancelRef.current = true;
    autoStartedRef.current = true;
    try {
      if (activeProjectId) {
        window.localStorage.removeItem(AUTORUN_CONSUMED_KEY(code, activeProjectId));
        window.localStorage.removeItem(AUTO_STUDIES_FLAG_KEY(code, activeProjectId));
      }
    } catch {
      /* ignore */
    }
    setProposals([]);
    setDismissed(new Set());
    setAuto({ kind: "idle" });
    // Wait for any in-flight run to release the shared lock before restarting.
    const tryStart = () => {
      const lockKey = activeProjectId ? `${code}:${activeProjectId}` : code;
      if (AUTO_STUDIES_LOCK.has(lockKey)) {
        setTimeout(tryStart, 100);
        return;
      }
      cancelRef.current = false;
      void runAuto();
    };
    setTimeout(tryStart, 50);
  }

  const consumed =
    typeof window !== "undefined" &&
    (() => {
      try {
        return !!activeProjectId && window.localStorage.getItem(AUTORUN_CONSUMED_KEY(code, activeProjectId)) === "1";
      } catch {
        return false;
      }
    })();

  const autoLabel =
    auto.kind === "proposing"
      ? "AUTO · drafting…"
      : auto.kind === "casting"
        ? `AUTO · casting ${auto.index + 1}/${auto.total}`
        : auto.kind === "drafting_studies"
          ? `AUTO · drafting studies ${auto.index + 1}/${auto.total}`
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

  // Publish to the global auto-run beacon so the state is visible even after
  // the user navigates away from this route.
  useEffect(() => {
    const id = `stage02:${code}`;
    const href = `/admin/countries/${code}/personas/segments`;
    if (auto.kind === "proposing") {
      publishAutoRun({
        id,
        scope: `Chamber 07 · Stage 02 · ${code}`,
        title: "Drafting segment proposals",
        detail: "AI is composing candidate segments…",
        status: "running",
        href,
      });
    } else if (auto.kind === "casting") {
      publishAutoRun({
        id,
        scope: `Chamber 07 · Stage 02 · ${code}`,
        title: "Casting segments",
        detail: `Casting ${auto.index + 1}/${auto.total} — ${auto.label}`,
        progress: { current: auto.index + 1, total: auto.total },
        status: "running",
        href,
      });
    } else if (auto.kind === "drafting_studies") {
      publishAutoRun({
        id,
        scope: `Chamber 07 · Stage 02 → 03 · ${code}`,
        title: "Drafting studies for every segment",
        detail: `Drafting ${auto.index + 1}/${auto.total} — ${auto.label}`,
        progress: { current: auto.index + 1, total: auto.total },
        status: "running",
        href,
      });
    } else if (auto.kind === "advancing") {
      publishAutoRun({
        id,
        scope: `Chamber 07 · Stage 02 → 03 · ${code}`,
        title: "Handing off to Rehearse",
        detail: `Auto-advancing in ${auto.countdown}s…`,
        status: "running",
        href,
      });
    } else if (auto.kind === "paused") {
      publishAutoRun({
        id,
        scope: `Chamber 07 · Stage 02 · ${code}`,
        title: "Auto-run paused",
        status: "paused",
        message: "Resume from the Segments page.",
        href,
      });
    } else if (auto.kind === "error") {
      publishAutoRun({
        id,
        scope: `Chamber 07 · Stage 02 · ${code}`,
        title: "Auto-run failed",
        status: "error",
        message: auto.message,
        href,
      });
    } else {
      // idle or complete → clear (Stage 03 beacon takes over after handoff)
      unregisterAutoRunAbort(id);
      clearAutoRun(id);
    }
    // Register resume so the watchdog can auto-fix a stall.
    if (auto.kind === "proposing" || auto.kind === "casting" || auto.kind === "drafting_studies") {
      registerAutoRunResume(id, () => runAuto());
      registerAutoRunAbort(id, () => {
        cancelAuto("Stopped by user.");
        AUTO_STUDIES_LOCK.delete(code);
      });
    }
    return () => {
      // On unmount, only clear if not still running — allow it to persist
      // across navigation while the state machine is active.
    };
  }, [auto, code, activeProjectId, runAuto, cancelAuto]);

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
            : "AI drafts segments, casts each, drafts a study for every segment, and advances to Rehearse"
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
            AI proposes the segments, casts them, and drafts studies.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            A segment is a coherent audience — the kind of group a Cabinet can actually act on.
            Press{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-950">
              Start Auto-run
            </span>{" "}
            and the AI drafts a divergent set grounded in {code}, casts each in sequence, drafts a
            study for every segment, and hands off to Rehearse for review.
          </p>
          {(segments.length > 0 || consumed) && auto.kind === "idle" && personaCount > 0 && (
            <p className="mt-2 text-[12px] italic text-ink-500">
              Auto-run already handed off once. Press Start Auto-run to draft a fresh set, cast
              them, and auto-draft studies for every segment.
            </p>
          )}
        </div>
        <AutoRunPrimary className="shrink-0" />
      </header>

      {/* Auto-run banner */}
      {personaCount > 0 &&
        (autoActive ||
          auto.kind === "paused" ||
          auto.kind === "error" ||
          auto.kind === "complete") && (
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
              <Sparkles
                size={14}
                className={autoActive ? "animate-pulse text-ink-950" : "text-ink-500"}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                Auto-run
              </span>
              <span>
                {auto.kind === "proposing" && "Drafting segment proposals from brief + personas…"}
                {auto.kind === "casting" &&
                  `Casting ${auto.index + 1} of ${auto.total} · “${auto.label}”…`}
                {auto.kind === "drafting_studies" &&
                  `Drafting studies ${auto.index + 1} of ${auto.total} · “${auto.label}”…`}
                {auto.kind === "advancing" && `Ready · advancing to Rehearse in ${auto.countdown}s`}
                {auto.kind === "complete" && "Handed off to Rehearse with all studies drafted."}
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
            The prompt shapes who joins the room.{" "}
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-700">
              Size
            </span>{" "}
            controls how divergent the set is — higher size = wider spread of views.
          </p>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Segment prompt
            </span>
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
              <input
                type="radio"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
              />{" "}
              Public
            </label>
            <label className="flex items-center gap-1 text-[11px] text-ink-700">
              <input
                type="radio"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
              />{" "}
              Private
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
          {gen.isError && (
            <p className="mt-2 text-[11px] text-rose-600">{(gen.error as Error).message}</p>
          )}
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
                    {s.size} personas · {s.visibility} ·{" "}
                    {new Date(s.created_at).toLocaleDateString()}
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
