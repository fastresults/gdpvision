// Chamber 07 · Program Brief intake — required first screen for every
// research program. No segments, studies, or auto-run are allowed to run
// until the admin has captured (type / dictate / upload), enriched, and
// confirmed the brief.
//
// The screen is a briefing, not a form: it states what the chamber has
// gathered, where the brief still thin, and exactly what confirming does.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";

import { MultimodalInput, type WizardUpload } from "./MultimodalInput";
import { PrettyJson } from "@/components/data/PrettyJson";
import { Explain } from "@/components/explain/Explain";
import { Illustration } from "@/components/marketing/Illustration";
import intakeArt from "@/assets/illustrations/research-field.jpg";
import {
  CoverageRow,
  ScopeReadOut,
  deriveCoverage,
  type ScopeLike,
} from "@/components/personas/ScopeReadOut";
import "@/lib/explain/personas-entries";
import { cn } from "@/lib/utils";
import {
  commitProjectBrief,
  enrichProjectBrief,
  getProjectBrief,
  saveProjectBrief,
} from "@/lib/personas/project-brief.functions";
import { useResolveAction } from "@/components/personas/field/stage-bus";

type Props = {
  code: string;
  projectId: string;
  onCommitted?: () => void;
  /** The field wizard owns the sole primary footer when embedded there. */
  embedded?: boolean;
};

const BEATS = [
  { key: "read", label: "Material read" },
  { key: "scope", label: "Scope confirmed" },
  { key: "open", label: "Chamber opens" },
] as const;

export function ProgramBriefIntake({ code, projectId, onCommitted, embedded = false }: Props) {
  const qc = useQueryClient();
  const briefQ = useQuery({
    queryKey: ["program-brief", projectId],
    queryFn: () => getProjectBrief({ data: { projectId } }),
  });

  const [text, setText] = useState("");
  const [briefSource, setBriefSource] = useState<WizardUpload | null>(null);
  const [uploads, setUploads] = useState<WizardUpload[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate local state once when the brief loads.
  useEffect(() => {
    if (hydrated || !briefQ.data) return;
    setText(briefQ.data.brief_raw ?? "");
    setBriefSource((briefQ.data.brief_source as WizardUpload | null) ?? null);
    setUploads(Array.isArray(briefQ.data.brief_uploads) ? (briefQ.data.brief_uploads as WizardUpload[]) : []);
    setHydrated(true);
  }, [briefQ.data, hydrated]);

  // Autosave (800ms debounce).
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      saveProjectBrief({
        data: { projectId, brief_raw: text, brief_source: briefSource, brief_uploads: uploads },
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [projectId, text, briefSource, uploads, hydrated]);

  const scope = (briefQ.data?.brief_scope ?? null) as ScopeLike | null;
  const typedChars = text.trim().length;
  const totalChars = useMemo(
    () =>
      typedChars +
      (briefSource?.excerpt?.length ?? 0) +
      uploads.reduce((s, u) => s + (u.excerpt?.length ?? 0), 0),
    [typedChars, briefSource, uploads],
  );
  const meetsMinimum = totalChars >= 40;

  const coverage = useMemo(
    () =>
      deriveCoverage(scope, {
        hasBrief: !!briefSource,
        contextCount: uploads.length,
        typedChars,
      }),
    [scope, briefSource, uploads.length, typedChars],
  );
  const openCount = coverage.filter((c) => c.state !== "captured").length;

  const enrich = useMutation({
    mutationFn: async () => {
      setError(null);
      // Flush pending edits before enrichment reads the row.
      await saveProjectBrief({
        data: { projectId, brief_raw: text, brief_source: briefSource, brief_uploads: uploads },
      });
      return enrichProjectBrief({ data: { projectId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["program-brief", projectId] }),
    onError: (e) => setError((e as Error).message),
  });

  const commit = useMutation({
    mutationFn: async () => {
      setError(null);
      await saveProjectBrief({
        data: { projectId, brief_raw: text, brief_source: briefSource, brief_uploads: uploads },
      });
      return commitProjectBrief({ data: { projectId } });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["program-brief", projectId] }),
        qc.invalidateQueries({ queryKey: ["persona-projects", code] }),
      ]);
      onCommitted?.();
    },
    onError: (e) => setError((e as Error).message),
  });

  if (briefQ.isLoading) {
    return (
      <div className="flex items-center gap-2 border border-line-200 bg-paper-50 p-6 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" /> Loading brief…
      </div>
    );
  }

  const activeBeat: (typeof BEATS)[number]["key"] = scope ? "scope" : "read";
  const busy = enrich.isPending || commit.isPending;
  const blockedReason = !meetsMinimum
    ? "Attach the source brief, or add a few more lines — 40 characters minimum."
    : null;
  const alreadyCommitted = !!briefQ.data?.committed_at;

  useResolveAction(
    "programme-brief",
    embedded && !alreadyCommitted
      ? scope
        ? {
            label: "Commit the brief",
            run: () => commit.mutate(),
            pending: commit.isPending,
            disabled: busy || !meetsMinimum,
          }
        : {
            label: "Read the brief material",
            run: () => enrich.mutate(),
            pending: enrich.isPending,
            disabled: busy || !meetsMinimum,
          }
      : null,
  );

  return (
    <section className="space-y-5 pb-24">
      {/* ── Briefing masthead ─────────────────────────────────────────── */}
      {!embedded ? <header className="border border-ink-950 bg-paper-0 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Stage 00 · Required · {code} · {briefQ.data?.title ?? "New programme"}
            </p>
            <h2 className="mt-2 font-serif text-2xl leading-tight text-ink-950 sm:text-3xl">
              {scope
                ? "Here is what the chamber read. Confirm it, or add what's missing."
                : "Capture the brief before any research runs."}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700">
              The{" "}
              <Explain id="research.intake.brief-precedence">source brief</Explain> governs the
              scope; supporting context can only qualify it. Nothing casts, groups or rehearses
              until you confirm — and confirming locks the scope, not the material: addenda can be
              added later from the programme header.
            </p>
          </div>
          <Illustration
            src={intakeArt}
            variant="mark"
            className="hidden shrink-0 opacity-80 lg:block"
          />
        </div>

        {/* Three-beat progress line */}
        <ol className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-200 pt-4">
          {BEATS.map((b, i) => {
            const done = (b.key === "read" && !!scope) || false;
            const active = b.key === activeBeat;
            return (
              <li key={b.key} className="flex items-center gap-3">
                {i > 0 && <span className="text-ink-300">→</span>}
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                    done ? "text-emerald-700" : active ? "text-ink-950" : "text-ink-300",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-full border text-[8px]",
                      done
                        ? "border-emerald-600 bg-emerald-600 text-paper-0"
                        : active
                          ? "border-ink-950 bg-ink-950 text-paper-0"
                          : "border-line-200",
                    )}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {b.label}
                </span>
              </li>
            );
          })}
        </ol>
      </header> : null}

      {/* ── What we gathered ──────────────────────────────────────────── */}
      <section className="border border-line-200 bg-paper-50 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          What we have gathered
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <EvidenceTile
            label="Source brief"
            primary={briefSource?.name ?? "None set"}
            detail={
              briefSource
                ? `${briefSource.excerpt?.length ?? 0} chars extracted · governs the scope`
                : "Promote one document below to govern the scope."
            }
            strong={!!briefSource}
          />
          <EvidenceTile
            label="Supporting context"
            primary={`${uploads.length} item${uploads.length === 1 ? "" : "s"}`}
            detail={
              uploads.length > 0
                ? uploads.map((u) => u.name).join(" · ")
                : "Optional — clippings, prior studies, memos."
            }
            strong={uploads.length > 0}
          />
          <EvidenceTile
            label="Typed or dictated"
            primary={`${typedChars} chars`}
            detail={`${totalChars} chars total read · autosaves`}
            strong={typedChars > 0}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Intake rail */}
        <div className="min-w-0 space-y-3 border border-line-200 bg-paper-0 p-4">
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-ink-500" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Intake · type · dictate · upload
            </p>
          </div>
          <div className="border border-ink-950 bg-paper-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Source brief · one only · governs the scope
            </p>
            {briefSource ? (
              <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-950">
                <FileText size={12} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{briefSource.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUploads((list) => [...list, briefSource]);
                    setBriefSource(null);
                  }}
                  className="btn-ghost"
                >
                  Demote to context
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-ink-700">
                None set — upload the governing document below, then mark it as the source brief.
                Everything else stays supporting context.
              </p>
            )}
          </div>
          <MultimodalInput
            countryCode={code}
            value={text}
            onChange={setText}
            onUpload={(u) => setUploads((prev) => [...prev, u])}
            uploads={uploads}
            placeholder="What are you trying to learn, decide, or defend? Who does it affect? What changed?"
            rows={12}
          />
          {uploads.length > 0 && (
            <ul className="space-y-1">
              {uploads.map((u, i) => (
                <li
                  key={`${u.path}-${i}`}
                  className="flex items-center gap-2 border border-line-200 px-2.5 py-1.5 text-[12px] text-ink-700"
                >
                  <FileText size={12} className="shrink-0 text-ink-300" />
                  <span className="min-w-0 flex-1 truncate text-ink-950">{u.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploads((list) => {
                        const rest = list.filter((_, idx) => idx !== i);
                        return briefSource ? [...rest, briefSource] : rest;
                      });
                      setBriefSource(u);
                    }}
                    className="btn-ghost"
                  >
                    Make source brief
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live coverage rail */}
        <aside className="min-w-0 space-y-3 self-start border border-line-200 bg-paper-50 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <Explain id="research.intake.readout">Where we're at</Explain>
            </p>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              {6 - openCount}/6 captured
            </span>
          </div>
          <ul className="space-y-2.5">
            {coverage.map((row) => (
              <CoverageRow key={row.key} row={row} />
            ))}
          </ul>
          <p className="border-t border-line-200 pt-3 text-[11px] leading-snug text-ink-500">
            {scope
              ? openCount === 0
                ? "Every dimension is covered. You can confirm the scope."
                : `${openCount} dimension${openCount === 1 ? "" : "s"} still thin — add material and re-read, or proceed and resolve them in the programme plan.`
              : "These are read from your material once the chamber reads it."}
          </p>
        </aside>
      </div>

      {/* ── Research Scope read-out ───────────────────────────────────── */}
      {scope && (
        <section className="border border-line-200 bg-paper-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-700" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950">
                Research Scope · as read from your material
              </p>
            </div>
            <button
              type="button"
              onClick={() => enrich.mutate()}
              disabled={busy || !meetsMinimum}
              className="btn-secondary disabled:opacity-40"
            >
              {enrich.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Sparkles size={11} />
              )}
              Re-read material
            </button>
          </div>
          <div className="mt-4">
            <ScopeReadOut scope={scope} />
          </div>
          <details className="mt-5 border-t border-line-200 pt-3">
            <summary className="cursor-pointer list-none font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
              Machine-readable scope ▾
            </summary>
            <div className="mt-3">
              <PrettyJson value={scope as never} />
            </div>
          </details>
        </section>
      )}

      {/* ── Single decisive action bar ────────────────────────────────── */}
      {!embedded ? <footer className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-ink-950 bg-paper-0/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/85">
        {scope ? (
          <button
            type="button"
            onClick={() => commit.mutate()}
            disabled={busy || !meetsMinimum}
            className="btn-primary disabled:opacity-40"
          >
            {commit.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} />
            )}
            {commit.isPending ? "Confirming…" : "Confirm scope & open the chamber"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => enrich.mutate()}
            disabled={busy || !meetsMinimum}
            className="btn-primary disabled:opacity-40"
          >
            {enrich.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {enrich.isPending ? "Reading your material…" : "Read my material"}
          </button>
        )}
        <p className="max-w-xl text-[11px] leading-snug text-ink-500">
          {blockedReason ??
            (scope
              ? "Confirming locks this scope for the programme and opens the next stage."
              : "The chamber reads brief first, context second, and returns a structured scope you can edit.")}
        </p>
        {error && <p className="w-full text-[12px] text-rose-600">{error}</p>}
      </footer> : error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
    </section>
  );
}

function EvidenceTile({
  label,
  primary,
  detail,
  strong,
}: {
  label: string;
  primary: string;
  detail: string;
  strong: boolean;
}) {
  return (
    <div className="min-w-0 border border-line-200 bg-paper-0 p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-serif text-[14px] leading-tight",
          strong ? "text-ink-950" : "text-ink-300",
        )}
      >
        {primary}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500">{detail}</p>
    </div>
  );
}
