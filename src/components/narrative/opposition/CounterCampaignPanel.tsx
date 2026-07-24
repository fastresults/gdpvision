import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Sparkles, RefreshCw, Send, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import {
  getOppositionItem,
  type OppositionItem,
  type OppositionPlan,
} from "@/lib/narrative/opposition-intake.functions";
import {
  analyzeOppositionItem,
  generateOppositionResponsePlan,
  publishOppositionPlanToComms,
} from "@/lib/narrative/opposition-plan.functions";

export type CounterCampaignStage = "idle" | "analyzing" | "drafting" | "ready" | "published" | "failed";

export function CounterCampaignPanel({
  itemId,
  code,
  onStageChange,
}: {
  itemId: string | null;
  code: string;
  onStageChange?: (stage: CounterCampaignStage) => void;
}) {
  const qc = useQueryClient();
  const getItem = useServerFn(getOppositionItem);
  const analyze = useServerFn(analyzeOppositionItem);
  const genPlan = useServerFn(generateOppositionResponsePlan);
  const publish = useServerFn(publishOppositionPlanToComms);

  const query = useQuery({
    enabled: !!itemId,
    queryKey: ["opposition-item", itemId],
    queryFn: () => getItem({ data: { id: itemId! } }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 3000;
      if (d.item.status === "analyzing" || d.item.status === "queued") return 2500;
      if (d.item.status === "analyzed" && !d.plan) return 3000;
      return false;
    },
  });

  const item = query.data?.item ?? null;
  const plan = query.data?.plan ?? null;

  const analyzeM = useMutation({
    mutationFn: async () => analyze({ data: { id: itemId! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opposition-item", itemId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analyze failed"),
  });

  const planM = useMutation({
    mutationFn: async () => genPlan({ data: { itemId: itemId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opposition-item", itemId] });
      qc.invalidateQueries({ queryKey: ["opposition-items", code] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Plan generation failed"),
  });

  const publishM = useMutation({
    mutationFn: async () => publish({ data: { itemId: itemId! } }),
    onSuccess: ({ id }) => {
      toast.success("Sent to Comms Library as a draft.");
      qc.invalidateQueries({ queryKey: ["comms", code] });
      onStageChange?.("published");
      // no navigation — keep the operator on the flow
      void id;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Publish failed"),
  });

  // Auto-fire plan generation the moment analysis lands.
  const autoFiredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!item) return;
    if (item.status === "analyzed" && !plan && !planM.isPending && autoFiredFor.current !== item.id) {
      autoFiredFor.current = item.id;
      planM.mutate();
    }
  }, [item, plan, planM]);

  // Broadcast stage upward for stepper.
  useEffect(() => {
    if (!onStageChange) return;
    if (!itemId) return onStageChange("idle");
    if (!item) return onStageChange("analyzing");
    if (item.status === "failed") return onStageChange("failed");
    if (item.status === "queued" || item.status === "analyzing") return onStageChange("analyzing");
    if (item.status === "analyzed" && !plan) return onStageChange(planM.isPending ? "drafting" : "drafting");
    if (plan) return onStageChange(publishM.isSuccess ? "published" : "ready");
    onStageChange("idle");
  }, [itemId, item, plan, planM.isPending, publishM.isSuccess, onStageChange]);

  if (!itemId) {
    return (
      <div className="border border-dashed border-line-200 bg-paper-0 p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Counter-campaign
        </p>
        <p className="mt-2 text-sm text-ink-700">
          Drop an intake or pick one from the queue below. The counter-campaign drafts itself the moment analysis lands.
        </p>
      </div>
    );
  }

  if (query.isLoading || !item) {
    return (
      <div className="flex items-center gap-2 border border-line-200 bg-paper-0 p-6 text-sm text-ink-700">
        <Loader2 size={14} className="animate-spin" /> Loading intake…
      </div>
    );
  }

  const status = item.status;
  const themes = Array.isArray(item.themes) ? (item.themes as string[]) : [];

  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="flex items-start justify-between gap-4 border-b border-line-200 p-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Focused intake · {item.kind}
          </p>
          <h3 className="mt-1 truncate font-serif text-xl text-ink-950">
            {item.title || item.source_url || "Untitled intake"}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            Captured {new Date(item.created_at).toLocaleString()} · status {status}
          </p>
        </div>
        <Link
          to="/admin/countries/$code/narrative/opposition/$id"
          params={{ code, id: item.id }}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
        >
          Open full view <ExternalLink size={11} />
        </Link>
      </header>

      {status === "failed" && item.status_error && (
        <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle size={14} className="mt-0.5" />
          <div className="flex-1">
            <p>Analysis failed: {item.status_error}</p>
          </div>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-xs"
            onClick={() => analyzeM.mutate()}
            disabled={analyzeM.isPending}
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      {(status === "queued" || status === "analyzing") && (
        <div className="flex items-center gap-2 border-b border-line-200 bg-paper-50 p-4 text-sm text-ink-700">
          <Loader2 size={14} className="animate-spin" /> Analyzing motivation, origin and amplification…
        </div>
      )}

      {item.motivation_summary && (
        <div className="border-b border-line-200 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Motivation</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.motivation_summary}</p>
          {themes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {themes.map((t) => (
                <span key={t} className="border border-line-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Counter-campaign
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {status === "analyzed" && (
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={() => planM.mutate()}
                disabled={planM.isPending}
              >
                {planM.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {plan ? "Regenerate" : "Generate counter-campaign"}
              </button>
            )}
            {plan && (
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1.5"
                onClick={() => publishM.mutate()}
                disabled={publishM.isPending}
              >
                {publishM.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {publishM.isSuccess ? "Sent to Library" : "Send to Comms Library"}
              </button>
            )}
          </div>
        </div>

        {!plan && planM.isPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-700">
            <Loader2 size={14} className="animate-spin" /> Drafting a McKinsey-grade response plan…
          </p>
        )}

        {!plan && !planM.isPending && (status === "queued" || status === "analyzing") && (
          <p className="mt-3 text-sm text-ink-500">
            Waiting on analysis. The plan drafts itself the moment motivation and origin land.
          </p>
        )}

        {plan && <PlanBody plan={plan} />}
      </div>
    </section>
  );
}

function PlanBody({ plan }: { plan: OppositionPlan }) {
  const km = Array.isArray(plan.key_messages) ? (plan.key_messages as Array<{ audience?: string; message: string }>) : [];
  const cp = Array.isArray(plan.channel_plan) ? (plan.channel_plan as Array<{ channel: string; cadence?: string; artifact_kind: string }>) : [];
  const actions = Array.isArray(plan.sequenced_actions) ? (plan.sequenced_actions as Array<{ when: string; action: string; owner?: string }>) : [];
  const risks = Array.isArray(plan.risks) ? (plan.risks as string[]) : [];
  const metrics = Array.isArray(plan.success_metrics) ? (plan.success_metrics as string[]) : [];
  const audiences = Array.isArray(plan.audience_segments) ? (plan.audience_segments as string[]) : [];

  return (
    <div className="mt-4 space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Posture · {plan.posture ?? "—"}
          {plan.confidence_grade ? ` · grade ${plan.confidence_grade}` : ""}
        </p>
        {plan.objective && <p className="mt-1 font-serif text-lg text-ink-950">{plan.objective}</p>}
        {audiences.length > 0 && (
          <p className="mt-1 text-xs text-ink-500">
            Audiences: <span className="text-ink-700">{audiences.join(" · ")}</span>
          </p>
        )}
      </div>

      {km.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Key messages</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
            {km.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-ink-500" />
                <span>
                  {m.audience && (
                    <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                      [{m.audience}]
                    </span>
                  )}
                  {m.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Sequenced actions</p>
          <ol className="mt-2 space-y-1.5 text-sm text-ink-700">
            {actions.map((a, i) => (
              <li key={i} className="flex gap-3 border-l-2 border-ink-950 pl-3">
                <span className="min-w-[60px] font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{a.when}</span>
                <span>{a.action}{a.owner ? ` — ${a.owner}` : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {cp.length > 0 && (
        <div className="overflow-hidden border border-line-200">
          <table className="w-full text-sm">
            <thead className="bg-paper-50 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              <tr>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Cadence</th>
                <th className="px-3 py-2">Artifact</th>
              </tr>
            </thead>
            <tbody>
              {cp.map((c, i) => (
                <tr key={i} className="border-t border-line-200">
                  <td className="px-3 py-2 text-ink-950">{c.channel}</td>
                  <td className="px-3 py-2 text-ink-700">{c.cadence ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
                    {c.artifact_kind}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {risks.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Risks</p>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
              {risks.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        )}
        {metrics.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Success metrics</p>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
              {metrics.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function inferStepper(items: OppositionItem[], focused: OppositionItem | null | undefined, focusedPlan: OppositionPlan | null | undefined, publishedFlag: boolean) {
  const anyIntake = items.length > 0 || !!focused;
  const stage = (() => {
    if (!focused) return "idle";
    if (focused.status === "failed") return "failed";
    if (focused.status === "queued" || focused.status === "analyzing") return "analyzing";
    if (focused.status === "analyzed" && !focusedPlan) return "drafting";
    if (focusedPlan) return publishedFlag ? "published" : "ready";
    return "idle";
  })();

  return {
    capture: anyIntake ? ("done" as const) : ("active" as const),
    analyze: stage === "analyzing" ? "active" : stage === "failed" ? "failed" : anyIntake && (focusedPlan || focused?.status === "analyzed") ? "done" : anyIntake ? "active" : "idle",
    plan: stage === "drafting" ? "active" : focusedPlan ? "done" : "idle",
    publish: stage === "published" ? "done" : focusedPlan ? "active" : "idle",
  } as const;
}
