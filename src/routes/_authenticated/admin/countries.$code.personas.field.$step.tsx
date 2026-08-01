// Chamber 07 · Field programme rail.
//
// One route serves every field stage: /admin/countries/$code/personas/field/$step
// Stage 01 (plan) is live — the AI derives a dated programme from the brief and
// the principal approves it. Later stages open once the plan is active.

import { createFileRoute, Link, Navigate, notFound, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ClipboardList, FileText, Loader2, Presentation } from "lucide-react";

import { FieldStepper, type FieldStageKey } from "@/components/personas/FieldStepper";
import { BriefingModal } from "@/components/personas/field/briefing/BriefingModal";
import { SplitAction } from "@/components/personas/field/briefing/SplitAction";
import { TrackerModal } from "@/components/personas/field/tracker/TrackerModal";
import { EvidenceStage } from "@/components/personas/field/EvidenceStage";
import { FieldworkStage } from "@/components/personas/field/FieldworkStage";
import { InstrumentsStage } from "@/components/personas/field/InstrumentsStage";
import { ParticipantsStage } from "@/components/personas/field/ParticipantsStage";
import { FieldStageProvider } from "@/components/personas/field/stage-bus";
import { StageFrame } from "@/components/personas/field/StageFrame";

import { TrackTabs } from "@/components/personas/TrackTabs";

import { useDossierActions } from "@/hooks/useDossierActions";
import { useResearchGate } from "@/hooks/useResearchGate";
import { getFieldProgress } from "@/lib/personas/field-progress.functions";
import type { FieldProgress } from "@/lib/personas/field-stages";
import {
  commitProgrammePlan,
  deriveProgrammePlan,
  getProgrammePlan,
} from "@/lib/personas/programme-plan.functions";

const STEPS: FieldStageKey[] = ["plan", "participants", "instruments", "fieldwork", "evidence"];

// The client-facing dossier is not a rail stage — it sits beside the rail and
// reads whatever the programme currently holds.
const BRIEFING_STEP = "briefing";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/field/$step")({
  head: ({ params }) => ({
    meta: [
      { title: `Field programme · ${params.step} · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  notFoundComponent: () => <p className="p-6 text-sm text-ink-500">No such field stage.</p>,
  component: FieldStagePage,
});

function FieldStagePage() {
  const { code, step } = Route.useParams();
  if (step !== BRIEFING_STEP && !STEPS.includes(step as FieldStageKey)) throw notFound();
  const stage = step as FieldStageKey;
  const search = useSearch({ strict: false }) as { project?: string };
  const projectId =
    typeof search.project === "string" && search.project ? search.project : undefined;
  const gate = useResearchGate(code, projectId);

  if (!projectId) {
    return <Navigate to="/admin/countries/$code/personas" params={{ code }} />;
  }

  return <FieldStageBody code={code} projectId={projectId} stage={stage} gate={gate} />;
}

function FieldStageBody({
  code,
  projectId,
  stage,
  gate,
}: {
  code: string;
  projectId: string;
  stage: FieldStageKey;
  gate: ReturnType<typeof useResearchGate>;
}) {
  const qc = useQueryClient();
  const [briefingOpen, setBriefingOpen] = useState((stage as string) === "briefing");
  const [briefingIntent, setBriefingIntent] = useState<"briefing" | "deck">("briefing");
  const [trackerOpen, setTrackerOpen] = useState(false);
  const openBriefing = (intent: "briefing" | "deck") => {
    setBriefingIntent(intent);
    setBriefingOpen(true);
  };

  // One read drives the rail, the "done when" test and the next action.
  const progressQ = useQuery({
    queryKey: ["field-progress", projectId],
    queryFn: (): Promise<FieldProgress> => getFieldProgress({ data: { projectId } }),
    enabled: gate.planCommitted,
  });
  const progress = progressQ.data;
  const studyId = progress?.studyId ?? null;
  // The client dossier only exists once the brief, the plan, the participants
  // and the instruments are all on file.
  const dossierReady =
    gate.committed &&
    gate.planCommitted &&
    (progress?.stages.participants.complete ?? false) &&
    (progress?.stages.instruments.complete ?? false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["field-progress", projectId] });
    void qc.invalidateQueries({ queryKey: ["persona-projects", code] });
  };

  // Both client-facing outputs are read and regenerated through one hook, so
  // the row, the panel and the deck viewer never disagree about the version.
  const dossier = useDossierActions(projectId, progress?.inputsUpdatedAt ?? null);

  /** Rebuilding a dossier already sent to the client is confirmed first. */
  const confirmIfShared = (): boolean => {
    const rec = dossier.briefing;
    if (!rec || rec.status !== "shared" || !rec.shared_at) return true;
    const sent = new Date(rec.shared_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    return window.confirm(
      `This dossier was sent to the client on ${sent}. Rebuilding replaces it with a new version.`,
    );
  };

  return (
    <FieldStageProvider>
      <div className="space-y-6">
        <FieldStepper
          code={code}
          active={stage}
          activeProjectId={projectId}
          briefCommitted={gate.committed}
          planCommitted={gate.planCommitted}
          progress={progress}
        />

        <TrackTabs
          code={code}
          projectId={projectId}
          track={gate.track}
          active="field"
          actions={
            gate.planCommitted ? (
              <>
                {dossierReady ? (
                  <>
                    <SplitAction
                      label="Discovery brief"
                      icon={<FileText size={13} />}
                      title="The full client-facing account of the approach, ready to send before fieldwork opens."
                      regenerateTitle={
                        dossier.briefingStaleReason ??
                        "Re-assemble the dossier from the brief, plan, participants and instruments as they stand now."
                      }
                      stale={dossier.briefingStale}
                      busy={dossier.assembling}
                      onOpen={() => openBriefing("briefing")}
                      onRegenerate={() => {
                        if (!confirmIfShared()) return;
                        dossier.assembleBriefing({ onDone: () => openBriefing("briefing") });
                      }}
                    />
                    <SplitAction
                      label="Presentation"
                      icon={<Presentation size={13} />}
                      title="The same approach as an on-brand slide presentation."
                      regenerateTitle={
                        dossier.deckStaleReason ?? "Re-compose the deck from the current dossier."
                      }
                      stale={dossier.deckStale}
                      busy={dossier.composing}
                      onOpen={() => openBriefing("deck")}
                      onRegenerate={() =>
                        dossier.composeDeck({ onDone: () => openBriefing("deck") })
                      }
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setTrackerOpen(true)}
                  title="Who owns what, when it is due, and what is blocked. Internal only."
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ClipboardList size={13} />
                  Project tracker
                </button>
              </>
            ) : null
          }
        />

        {dossier.error ? (
          <p className="border border-signal-negative/40 bg-signal-negative/5 px-4 py-2 text-sm text-ink-800">
            {dossier.error}
          </p>
        ) : null}

        {(stage as string) === "briefing" ? (
          dossierReady ? (
            <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
              <p className="font-serif text-lg text-ink-950">The briefing opens in a window.</p>
              <p className="mt-1 text-sm text-ink-700">
                Use “Discovery brief” above to read, print or export the dossier.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
              <p className="font-serif text-lg text-ink-950">
                {!gate.committed
                  ? "Write the brief first."
                  : !gate.planCommitted
                    ? "Approve the programme plan first."
                    : !(progress?.stages.participants.complete ?? false)
                      ? "Settle the participants first."
                      : "Draft the instruments first."}
              </p>
              <p className="mt-1 text-sm text-ink-700">
                The briefing is assembled from the brief, the approved programme, the participants
                and the instruments.
              </p>
            </div>
          )
        ) : !gate.committed && !gate.loading ? (
          <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
            <p className="font-serif text-lg text-ink-950">The brief comes first.</p>
            <p className="mt-1 max-w-xl text-sm text-ink-700">
              A field programme is planned from the brief — its questions, constraints and deadline
              set the phases, the participants and the instruments.
            </p>
            <Link
              to="/admin/countries/$code/personas"
              params={{ code }}
              search={{ project: projectId, open: 1 }}
              className="btn-primary mt-4 inline-flex"
            >
              Write the brief
            </Link>
          </div>
        ) : stage === "plan" ? (
          <StageFrame
            code={code}
            projectId={projectId}
            stage="plan"
            progress={progress}
            progressPending={progressQ.isFetching}
            progressError={progressQ.isError ? "unreadable" : null}
            onRetryProgress={() => void progressQ.refetch()}
          >
            <PlanStage code={code} projectId={projectId} onChanged={refresh} />
          </StageFrame>
        ) : !gate.planCommitted ? (
          <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
            <p className="font-serif text-lg text-ink-950">Approve the programme plan first.</p>
            <p className="mt-1 text-sm text-ink-700">
              Participants, instruments and fieldwork are all scheduled against the approved plan.
            </p>
            <Link
              to="/admin/countries/$code/personas/field/$step"
              params={{ code, step: "plan" }}
              search={{ project: projectId }}
              className="btn-primary mt-4 inline-flex"
            >
              Open the programme plan
            </Link>
          </div>
        ) : (
          <StageFrame
            code={code}
            projectId={projectId}
            stage={stage}
            progress={progress}
            progressPending={progressQ.isFetching}
            progressError={progressQ.isError ? "unreadable" : null}
            onRetryProgress={() => void progressQ.refetch()}
          >
            {progressQ.isLoading ? (
              <p className="text-sm text-ink-500">Reading the programme…</p>
            ) : stage === "participants" ? (
              <ParticipantsStage code={code} projectId={projectId} onChanged={refresh} />
            ) : stage === "instruments" ? (
              <InstrumentsStage studyId={studyId} onChanged={refresh} />
            ) : stage === "fieldwork" ? (
              <FieldworkStage
                code={code}
                projectId={projectId}
                studyId={studyId}
                onChanged={refresh}
              />
            ) : (
              <EvidenceStage
                projectId={projectId}
                studyId={studyId}
                finding={progress?.fieldFinding ?? null}
                closed={progress?.stages.evidence.complete ?? false}
                onChanged={refresh}
              />
            )}
          </StageFrame>
        )}

        <TrackerModal
          open={trackerOpen}
          code={code}
          projectId={projectId}
          onClose={() => setTrackerOpen(false)}
        />

        <BriefingModal
          open={briefingOpen && dossierReady}
          intent={briefingIntent}
          projectId={projectId}
          inputsUpdatedAt={progress?.inputsUpdatedAt ?? null}
          onClose={() => setBriefingOpen(false)}
        />
      </div>
    </FieldStageProvider>
  );
}

function PlanStage({
  code,
  projectId,
  onChanged,
}: {
  code: string;
  projectId: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [steering, setSteering] = useState("");
  const deriveFn = useServerFn(deriveProgrammePlan);
  const commitFn = useServerFn(commitProgrammePlan);

  const planQ = useQuery({
    queryKey: ["programme-plan", projectId],
    queryFn: () => getProgrammePlan({ data: { projectId } }),
  });

  const derive = useMutation({
    mutationFn: () => deriveFn({ data: { projectId, steering: steering.trim() || null } }),
    onSuccess: () => {
      setSteering("");
      void qc.invalidateQueries({ queryKey: ["programme-plan", projectId] });
    },
  });
  const commit = useMutation({
    mutationFn: (planId: string) => commitFn({ data: { planId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programme-plan", projectId] });
      void qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      onChanged();
    },
  });

  const data = planQ.data;
  const plan = data?.plan as
    | {
        id: string;
        status: string;
        summary?: string | null;
        starts_on?: string | null;
        ends_on?: string | null;
        rationale?: unknown;
      }
    | undefined;
  const durationRationale =
    plan?.rationale && typeof plan.rationale === "object"
      ? ((plan.rationale as { duration?: unknown }).duration as string | undefined)
      : undefined;

  return (
    <section className="space-y-5">
      <div className="border border-line-200 bg-paper-0 p-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Steering (optional)
          </span>
          <textarea
            value={steering}
            onChange={(e) => setSteering(e.target.value)}
            rows={2}
            placeholder="e.g. Cabinet needs a read before the budget; keep fieldwork inside eight weeks."
            className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-sm focus:border-ink-950 focus:outline-none"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => derive.mutate()}
            disabled={derive.isPending}
            className="btn-primary"
          >
            {derive.isPending ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Drafting…
              </>
            ) : plan ? (
              "Redraft the programme"
            ) : (
              "Draft the programme"
            )}
          </button>
          {plan && plan.status !== "active" && (
            <button
              type="button"
              onClick={() => commit.mutate(plan.id)}
              disabled={commit.isPending}
              className="btn-secondary"
            >
              {commit.isPending ? "Approving…" : "Approve plan"}
            </button>
          )}
          {plan?.status === "active" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700">
              Plan active
            </span>
          )}
        </div>
        {derive.isError && (
          <p className="mt-2 text-[11px] text-rose-600">{(derive.error as Error).message}</p>
        )}
        {commit.isError && (
          <p className="mt-2 text-[11px] text-rose-600">{(commit.error as Error).message}</p>
        )}
      </div>

      {planQ.isLoading ? (
        <p className="text-sm text-ink-500">Loading the programme…</p>
      ) : !data ? (
        <p className="border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
          No programme drafted yet.
        </p>
      ) : (
        <div className="space-y-4">
          {plan?.summary ? (
            <div className="border border-line-200 bg-paper-0 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                The programme in a paragraph
              </p>
              <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-800">
                {plan.summary}
              </p>
              {durationRationale ? (
                <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-ink-600">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    Why this span ·{" "}
                  </span>
                  {durationRationale}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Window" value={`${plan?.starts_on ?? "—"} → ${plan?.ends_on ?? "—"}`} />
            <Fact label="Phases" value={String(data.phases.length)} />
            <Fact label="Deliverables" value={String(data.deliverables.length)} />
          </div>

          <PhaseList
            phases={data.phases as Array<Record<string, unknown>>}
            milestones={data.milestones as Array<Record<string, unknown>>}
            deliverables={data.deliverables as Array<Record<string, unknown>>}
          />
        </div>
      )}
    </section>
  );
}

/** The name the AI gave this phase — never a generic placeholder. */
function phaseName(p: Record<string, unknown>, i: number): string {
  const name = (p.name ?? p.title) as string | undefined;
  if (typeof name === "string" && name.trim()) return name.trim();
  const intent = p.intent ?? p.purpose;
  if (typeof intent === "string" && intent.trim()) {
    const first = intent.trim().split(/[.;—]/)[0] ?? intent.trim();
    return first.length > 64 ? `${first.slice(0, 63).trimEnd()}…` : first;
  }
  return `Phase ${String(i + 1).padStart(2, "0")} · awaiting a name`;
}

function PhaseList({
  phases,
  milestones,
  deliverables,
}: {
  phases: Array<Record<string, unknown>>;
  milestones: Array<Record<string, unknown>>;
  deliverables: Array<Record<string, unknown>>;
}) {
  if (phases.length === 0) return null;
  const milestoneIds = new Set(milestones.map((m) => String(m.id)));
  return (
    <ol className="divide-y divide-line-200 border border-line-200 bg-paper-0">
      {phases.map((p, i) => {
        const mine = milestones.filter((m) => String(m.phase_id ?? "") === String(p.id ?? ""));
        const mineIds = new Set(mine.map((m) => String(m.id)));
        const drops = deliverables.filter((d) => {
          const mid = String(d.milestone_id ?? "");
          if (mid && mineIds.has(mid)) return true;
          // Deliverables not bound to any milestone sit with the last phase.
          return !mid || !milestoneIds.has(mid) ? i === phases.length - 1 : false;
        });
        const intent = (p.intent ?? p.purpose) as string | undefined;
        return (
          <li key={String(p.id ?? i)} className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Phase {String(i + 1).padStart(2, "0")} · {String(p.starts_on ?? "—")} →{" "}
              {String(p.ends_on ?? "—")}
            </p>
            <p className="mt-0.5 font-serif text-lg text-ink-950">{phaseName(p, i)}</p>
            {intent ? <p className="mt-1 max-w-3xl text-[13px] text-ink-700">{intent}</p> : null}

            {mine.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-l border-line-200 pl-3">
                {mine.map((m) => (
                  <li key={String(m.id)} className="text-[13px] text-ink-800">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      {String(m.due_on ?? "—")}
                    </span>{" "}
                    · {String(m.title ?? "Milestone")}
                    {m.owner ? <span className="text-ink-500"> — {String(m.owner)}</span> : null}
                    {m.detail ? (
                      <span className="block text-[12px] text-ink-600">{String(m.detail)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {drops.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {drops.map((d) => (
                  <span
                    key={String(d.id)}
                    className="border border-line-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-600"
                  >
                    {String(d.title ?? "Deliverable")} · {String(d.due_on ?? "—")}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-200 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-lg text-ink-950">{value}</p>
    </div>
  );
}
