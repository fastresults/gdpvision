// Chamber 07 · Field programme rail.
//
// One route serves every field stage: /admin/countries/$code/personas/field/$step
// Stage 01 (plan) is live — the AI derives a dated programme from the brief and
// the principal approves it. Later stages open once the plan is active.

import { createFileRoute, Link, Navigate, notFound, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarRange, ClipboardList, Library, Loader2, Mic, Users } from "lucide-react";

import { FieldStepper, type FieldStageKey } from "@/components/personas/FieldStepper";
import { TrackTabs } from "@/components/personas/TrackTabs";
import { PrettyJson } from "@/components/data/PrettyJson";
import { useResearchGate } from "@/hooks/useResearchGate";
import {
  commitProgrammePlan,
  deriveProgrammePlan,
  getProgrammePlan,
} from "@/lib/personas/programme-plan.functions";

const STEPS: FieldStageKey[] = ["plan", "participants", "instruments", "fieldwork", "evidence"];

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
  if (!STEPS.includes(step as FieldStageKey)) throw notFound();
  const stage = step as FieldStageKey;
  const search = useSearch({ strict: false }) as { project?: string };
  const projectId = typeof search.project === "string" && search.project ? search.project : undefined;
  const gate = useResearchGate(code, projectId);

  if (!projectId) {
    return (
      <Navigate to="/admin/countries/$code/personas" params={{ code }} />
    );
  }

  return (
    <div className="space-y-6">
      <FieldStepper
        code={code}
        active={stage}
        activeProjectId={projectId}
        briefCommitted={gate.committed}
        planCommitted={gate.planCommitted}
      />

      <TrackTabs code={code} projectId={projectId} track={gate.track} active="field" />

      {!gate.committed && !gate.loading ? (
        <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
          <p className="font-serif text-lg text-ink-950">The brief comes first.</p>
          <p className="mt-1 max-w-xl text-sm text-ink-700">
            A field programme is planned from the brief — its questions, constraints and deadline set
            the phases, the participants and the instruments.
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
        <PlanStage code={code} projectId={projectId} />
      ) : gate.planCommitted ? (
        <StagePlaceholder stage={stage} />
      ) : (
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
      )}
    </div>
  );
}

function PlanStage({ code, projectId }: { code: string; projectId: string }) {
  const qc = useQueryClient();
  const [steering, setSteering] = useState("");
  const deriveFn = useServerFn(deriveProgrammePlan);
  const commitFn = useServerFn(commitProgrammePlan);

  const planQ = useQuery({
    queryKey: ["programme-plan", projectId],
    queryFn: () => getProgrammePlan({ data: { projectId } }),
  });

  const derive = useMutation({
    mutationFn: () =>
      deriveFn({ data: { projectId, steering: steering.trim() || null } }),
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
    },
  });

  const data = planQ.data;
  const plan = data?.plan as { id: string; status: string; starts_on?: string | null; ends_on?: string | null; rationale?: unknown } | undefined;

  return (
    <section className="space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage 01 · Programme plan
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">A dated programme, derived from the brief</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-700">
          The AI reads the brief and proposes the phases, milestones, deliverables and method mix this
          question actually needs — nothing templated. Steer it, redraft, then approve.
        </p>
      </header>

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
          <button type="button" onClick={() => derive.mutate()} disabled={derive.isPending} className="btn-primary">
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
        {derive.isError && <p className="mt-2 text-[11px] text-rose-600">{(derive.error as Error).message}</p>}
        {commit.isError && <p className="mt-2 text-[11px] text-rose-600">{(commit.error as Error).message}</p>}
      </div>

      {planQ.isLoading ? (
        <p className="text-sm text-ink-500">Loading the programme…</p>
      ) : !data ? (
        <p className="border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
          No programme drafted yet.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Window" value={`${plan?.starts_on ?? "—"} → ${plan?.ends_on ?? "—"}`} />
            <Fact label="Phases" value={String(data.phases.length)} />
            <Fact label="Deliverables" value={String(data.deliverables.length)} />
          </div>

          <PhaseList phases={data.phases as Array<Record<string, unknown>>} />

          <details className="border border-line-200 bg-paper-0">
            <summary className="cursor-pointer px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Milestones & deliverables
            </summary>
            <div className="border-t border-line-200 p-4">
              <PrettyJson value={{ milestones: data.milestones, deliverables: data.deliverables }} />
            </div>
          </details>

          {plan?.rationale ? (
            <div className="border border-line-200 bg-paper-0 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Why this shape</p>
              <div className="mt-2">
                <PrettyJson value={plan.rationale} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function PhaseList({ phases }: { phases: Array<Record<string, unknown>> }) {
  if (phases.length === 0) return null;
  return (
    <ol className="divide-y divide-line-200 border border-line-200 bg-paper-0">
      {phases.map((p, i) => (
        <li key={String(p.id ?? i)} className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Phase {String(i + 1).padStart(2, "0")} · {String(p.starts_on ?? "—")} → {String(p.ends_on ?? "—")}
          </p>
          <p className="mt-0.5 font-serif text-lg text-ink-950">{String(p.title ?? "Untitled phase")}</p>
          {p.purpose ? <p className="mt-1 text-[13px] text-ink-700">{String(p.purpose)}</p> : null}
        </li>
      ))}
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

const PLACEHOLDER: Record<string, { icon: typeof Users; title: string; body: string }> = {
  participants: {
    icon: Users,
    title: "Participants",
    body: "The contact book for this programme — panels, consent, opt-outs and invitations, with every message logged.",
  },
  instruments: {
    icon: ClipboardList,
    title: "Instruments",
    body: "Questionnaires, discussion guides and stimulus, versioned against the approved plan.",
  },
  fieldwork: {
    icon: Mic,
    title: "Fieldwork",
    body: "Collections, sessions, attendance and returns — recordings and transcripts attach here.",
  },
  evidence: {
    icon: Library,
    title: "Evidence",
    body: "Every return filed to the second brain, then synthesised and calibrated against the synthetic pass.",
  },
};

function StagePlaceholder({ stage }: { stage: FieldStageKey }) {
  const meta = PLACEHOLDER[stage] ?? { icon: CalendarRange, title: stage, body: "" };
  const Icon = meta.icon;
  return (
    <div className="border border-dashed border-line-200 bg-paper-100/30 p-8 text-center">
      <Icon className="mx-auto text-ink-500" size={24} strokeWidth={1.5} />
      <h3 className="mt-3 font-serif text-xl text-ink-950">{meta.title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-ink-700">{meta.body}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Server engine ready · workspace lands next
      </p>
    </div>
  );
}
