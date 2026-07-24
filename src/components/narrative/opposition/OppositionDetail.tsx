import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles, ExternalLink, Archive } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import type { OppositionItem, OppositionPlan } from "@/lib/narrative/opposition-intake.functions";
import { archiveOppositionItem } from "@/lib/narrative/opposition-intake.functions";
import {
  analyzeOppositionItem,
  generateOppositionResponsePlan,
} from "@/lib/narrative/opposition-plan.functions";
import { CitedText } from "@/components/citations/CitedText";
import type { CitationRef } from "@/components/citations/CitationSup";

function toCitations(raw: unknown): CitationRef[] {
  const arr = Array.isArray(raw) ? (raw as string[]) : [];
  return arr.map((u) => {
    let host: string | undefined;
    try {
      host = new URL(u).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    return { url: u, title: host, label: host };
  });
}

export function OppositionDetail({
  item,
  plan,
  signedUrl,
  code,
}: {
  item: OppositionItem;
  plan: OppositionPlan | null;
  signedUrl: string | null;
  code: string;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const analyze = useServerFn(analyzeOppositionItem);
  const genPlan = useServerFn(generateOppositionResponsePlan);
  const archive = useServerFn(archiveOppositionItem);

  const analyzeM = useMutation({
    mutationFn: async () => analyze({ data: { id: item.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opposition-item", item.id] });
      qc.invalidateQueries({ queryKey: ["opposition-items", code] });
    },
  });
  const planM = useMutation({
    mutationFn: async () => genPlan({ data: { itemId: item.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opposition-item", item.id] }),
  });
  const archiveM = useMutation({
    mutationFn: async () => archive({ data: { id: item.id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["opposition-items", code] });
      nav({ to: "/admin/countries/$code/narrative/opposition", params: { code } });
    },
  });

  const citations = toCitations(item.citations);
  const themes = Array.isArray(item.themes) ? (item.themes as string[]) : [];
  const amp = (item.amplification ?? {}) as Record<string, unknown>;

  const keyMessages = plan && Array.isArray(plan.key_messages) ? (plan.key_messages as Array<{ audience?: string; message: string }>) : [];
  const channelPlan = plan && Array.isArray(plan.channel_plan) ? (plan.channel_plan as Array<{ channel: string; cadence?: string; artifact_kind: string }>) : [];
  const actions = plan && Array.isArray(plan.sequenced_actions) ? (plan.sequenced_actions as Array<{ when: string; action: string; owner?: string }>) : [];
  const risks = plan && Array.isArray(plan.risks) ? (plan.risks as string[]) : [];
  const metrics = plan && Array.isArray(plan.success_metrics) ? (plan.success_metrics as string[]) : [];
  const audiences = plan && Array.isArray(plan.audience_segments) ? (plan.audience_segments as string[]) : [];

  return (
    <div className="space-y-6">
      <header className="border border-line-200 bg-paper-0 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Opposition intel · {item.kind}
              {item.submitted_channel ? ` · ${item.submitted_channel}` : ""}
            </p>
            <h2 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
              {item.title || item.source_url || "Untitled intake"}
            </h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              Captured {new Date(item.created_at).toLocaleString()} · status {item.status}
              {item.confidence_grade ? ` · grade ${item.confidence_grade}` : ""}
            </p>
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-950"
              >
                <ExternalLink size={10} /> primary link
              </a>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => analyzeM.mutate()}
              disabled={analyzeM.isPending}
              className="btn-secondary inline-flex items-center gap-1.5"
            >
              {analyzeM.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Re-analyze
            </button>
            <button
              type="button"
              onClick={() => planM.mutate()}
              disabled={planM.isPending || item.status !== "analyzed"}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {planM.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {plan ? "Regenerate plan" : "Draft response"}
            </button>
            <button
              type="button"
              onClick={() => archiveM.mutate()}
              disabled={archiveM.isPending}
              className="btn-ghost inline-flex items-center gap-1.5 text-[11px]"
            >
              <Archive size={11} /> Archive
            </button>
          </div>
        </div>

        {signedUrl && item.mime_type?.startsWith("image/") && (
          <img
            src={signedUrl}
            alt={item.title ?? "opposition intake"}
            className="mt-4 max-h-[360px] border border-line-200 object-contain"
          />
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Severity" value={item.severity ? `${item.severity} / 5` : "—"} />
          <Stat label="Sentiment" value={item.sentiment === null || item.sentiment === undefined ? "—" : item.sentiment > 0 ? `+${item.sentiment}` : String(item.sentiment)} />
          <Stat label="Themes" value={themes.slice(0, 2).join(", ") || "—"} />
          <Stat label="First seen" value={(amp.first_seen_platform as string) || "—"} />
        </div>
      </header>

      {item.status === "failed" && item.status_error && (
        <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Analysis failed: {item.status_error}
        </p>
      )}

      {item.motivation_summary && (
        <section className="border border-line-200 bg-paper-0 p-5">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Motivation
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            <CitedText text={item.motivation_summary} citations={citations} />
          </p>
          {themes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {themes.map((t) => (
                <span
                  key={t}
                  className="border border-line-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {item.origin_summary && (
        <section className="border border-line-200 bg-paper-0 p-5">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Origin & amplification
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            <CitedText text={item.origin_summary} citations={citations} />
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-700 md:grid-cols-2">
            {Object.entries(amp).map(([k, v]) => (
              <div key={k} className="border-t border-line-200 pt-1.5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{k.replaceAll("_", " ")}</dt>
                <dd className="mt-0.5">{Array.isArray(v) ? v.join(", ") : String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {plan && (
        <section className="border border-line-200 bg-paper-0 p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Recommended response
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">
              Posture · {plan.posture ?? "—"}
              {plan.confidence_grade ? ` · grade ${plan.confidence_grade}` : ""}
            </span>
          </div>
          {plan.objective && <p className="mt-3 font-serif text-lg text-ink-950">{plan.objective}</p>}

          {keyMessages.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Key messages</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                {keyMessages.map((m, i) => (
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

          {audiences.length > 0 && (
            <p className="mt-3 text-xs text-ink-500">
              Audiences: <span className="text-ink-700">{audiences.join(" · ")}</span>
            </p>
          )}

          {actions.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Sequenced actions</p>
              <ol className="mt-2 space-y-1.5 text-sm text-ink-700">
                {actions.map((a, i) => (
                  <li key={i} className="flex gap-3 border-l-2 border-ink-950 pl-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 min-w-[60px]">{a.when}</span>
                    <span>{a.action}{a.owner ? ` — ${a.owner}` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {channelPlan.length > 0 && (
            <div className="mt-4 overflow-hidden border border-line-200">
              <table className="w-full text-sm">
                <thead className="bg-paper-50 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2">Cadence</th>
                    <th className="px-3 py-2">Artifact</th>
                  </tr>
                </thead>
                <tbody>
                  {channelPlan.map((c, i) => (
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

          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        </section>
      )}

      {citations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {citations.slice(0, 20).map((c, i) => (
            <a
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 border border-line-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 hover:border-ink-950 hover:text-ink-950"
            >
              <sup className="font-semibold text-ink-950">{i + 1}</sup> {c.title ?? c.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-200 p-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-lg tabular-nums text-ink-950">{value}</p>
    </div>
  );
}
