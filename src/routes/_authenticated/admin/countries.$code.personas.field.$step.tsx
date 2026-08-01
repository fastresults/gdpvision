// Chamber 07 · Field programme rail.
//
// One route serves every field stage: /admin/countries/$code/personas/field/$step
// Stage 01 (plan) is live — the AI derives a dated programme from the brief and
// the principal approves it. Later stages open once the plan is active.

import { createFileRoute, Link, Navigate, notFound, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { FieldStepper, type FieldStageKey } from "@/components/personas/FieldStepper";
import { BriefStage } from "@/components/personas/field/BriefStage";
import { EvidenceStage } from "@/components/personas/field/EvidenceStage";
import { FieldworkStage } from "@/components/personas/field/FieldworkStage";
import { InstrumentsStage } from "@/components/personas/field/InstrumentsStage";
import { ParticipantsStage } from "@/components/personas/field/ParticipantsStage";
import { FieldStageProvider } from "@/components/personas/field/stage-bus";
import { StageFrame } from "@/components/personas/field/StageFrame";
import { ShowTheDetail, StageWizard } from "@/components/personas/field/StageWizard";

import { useResearchGate } from "@/hooks/useResearchGate";
import { getFieldProgress } from "@/lib/personas/field-progress.functions";
import type { FieldProgress } from "@/lib/personas/field-stages";
import {
  commitProgrammePlan,
  deriveProgrammePlan,
  getProgrammePlan,
} from "@/lib/personas/programme-plan.functions";

const STEPS: FieldStageKey[] = [
  "brief",
  "plan",
  "participants",
  "instruments",
  "fieldwork",
  "evidence",
];

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
  // One read drives the rail, the "done when" test and the next action.
  const progressQ = useQuery({
    queryKey: ["field-progress", projectId],
    queryFn: (): Promise<FieldProgress> => getFieldProgress({ data: { projectId } }),
    enabled: gate.committed,
  });
  const progress = progressQ.data;
  const studyId = progress?.studyId ?? null;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["field-progress", projectId] });
    void qc.invalidateQueries({ queryKey: ["persona-projects", code] });
  };

  return (
    <FieldStageProvider>
      <div className="space-y-6">
        <FieldStepper
          active={stage}
          briefCommitted={gate.committed}
          planCommitted={gate.planCommitted}
          progress={progress}
        />

        {(stage as string) === "briefing" ? (
          <Navigate
            to="/admin/countries/$code/personas"
            params={{ code }}
            search={{ project: projectId }}
          />
        ) : stage === "brief" ? (
          <StageFrame
            code={code}
            projectId={projectId}
            stage="brief"
            progress={progress}
            progressPending={progressQ.isFetching}
            progressError={progressQ.isError ? "unreadable" : null}
            onRetryProgress={() => void progressQ.refetch()}
          >
            <BriefStage
              code={code}
              projectId={projectId}
              committed={gate.committed}
              onChanged={refresh}
            />
          </StageFrame>
        ) : !gate.committed && !gate.loading ? (
          <StageFrame
            code={code}
            projectId={projectId}
            stage={stage}
            progress={progress}
            progressPending={progressQ.isFetching}
            progressError={progressQ.isError ? "unreadable" : null}
            onRetryProgress={() => void progressQ.refetch()}
          >
            <div className="border border-ink-950 bg-paper-50 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Locked prerequisite
              </p>
              <p className="mt-2 font-serif text-xl text-ink-950">The brief comes first.</p>
              <p className="mt-1 max-w-xl text-sm text-ink-700">
                Return to Stage 00 and commit the question of record before this decision can open.
              </p>
              <Link
                to="/admin/countries/$code/personas/field/$step"
                params={{ code, step: "brief" }}
                search={{ project: projectId }}
                className="btn-primary mt-4 inline-flex"
              >
                Return to the brief
              </Link>
            </div>
          </StageFrame>
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
          <StageFrame
            code={code}
            projectId={projectId}
            stage={stage}
            progress={progress}
            progressPending={progressQ.isFetching}
            progressError={progressQ.isError ? "unreadable" : null}
            onRetryProgress={() => void progressQ.refetch()}
          >
            <div className="border border-ink-950 bg-paper-50 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Locked prerequisite
              </p>
              <p className="mt-2 font-serif text-xl text-ink-950">Approve the programme first.</p>
              <p className="mt-1 max-w-xl text-sm text-ink-700">
                Participant recruitment, instruments and fieldwork must inherit an approved method
                mix and dates.
              </p>
              <Link
                to="/admin/countries/$code/personas/field/$step"
                params={{ code, step: "plan" }}
                search={{ project: projectId }}
                className="btn-primary mt-4 inline-flex"
              >
                Return to the programme
              </Link>
            </div>
          </StageFrame>
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

  const drafting = (
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
      {derive.isError ? (
        <p className="mt-3 text-[11px] text-rose-600">{(derive.error as Error).message}</p>
      ) : null}
    </div>
  );

  const approval = (
    <div className="border border-line-200 bg-paper-0 p-4">
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-700">
        Approving fixes the dates and the method mix. Everything downstream — who you hear from,
        what you ask them, which waves you field — is derived from what you approve here.
      </p>
      {plan?.status === "active" ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700">
          Plan active
        </span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Nothing to approve yet
        </span>
      )}
      {commit.isError && (
        <p className="text-[11px] text-rose-600">{(commit.error as Error).message}</p>
      )}
    </div>
  );

  const planView = planQ.isLoading ? (
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
  );

  return (
    <StageWizard
      actions={{
        draft: {
          instruction:
            "Let the chamber infer the dated shape of the work from the brief, then read it.",
          outstanding: plan ? null : "no programme has been drafted yet",
          doneNote: plan ? "Programme drafted — editable until approved" : null,
          error: derive.isError ? (derive.error as Error).message : null,
          action: {
            label: plan ? "Redraft the programme" : "Draft the programme",
            onClick: () => derive.mutate(),
            pending: derive.isPending,
            note: "Reads the brief and proposes the dated programme for your review.",
          },
        },
        approve: {
          instruction:
            "Approve the programme so participants, instruments and fieldwork can be scheduled against it.",
          outstanding: plan?.status === "active" ? null : "the plan is not approved",
          doneNote: "Plan approved and active",
          error: commit.isError ? (commit.error as Error).message : null,
          action:
            plan && plan.status !== "active"
              ? {
                  label: "Approve this plan",
                  onClick: () => commit.mutate(plan.id),
                  pending: commit.isPending,
                  note: "Fixes the dates and method mix and unlocks participant recruitment.",
                }
              : null,
        },
      }}
      panels={{
        // ── Step 1 · Let the chamber draft the programme ───────────────────
        draft: (
          <div className="space-y-5">
            {drafting}
            {planView}
          </div>
        ),

        // ── Step 2 · Approve it ────────────────────────────────────────────
        approve: (
          <div className="space-y-5">
            {approval}
            {planView}
            <ShowTheDetail label="Redraft it instead">{drafting}</ShowTheDetail>
          </div>
        ),
      }}
    />
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
