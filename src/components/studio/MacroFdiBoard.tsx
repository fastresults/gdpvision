import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { getFdiPosture, type PostureView } from "@/lib/fdi-studio/posture.functions";
import { generatePlaybook, listPlaybooks } from "@/lib/fdi-studio/playbook.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { PlaybookTimeline } from "./PlaybookTimeline";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export function MacroFdiBoard({ code }: { code: string }) {
  const qc = useQueryClient();
  const postureFn = useServerFn(getFdiPosture);
  const listFn = useServerFn(listPlaybooks);
  const genFn = useServerFn(generatePlaybook);

  const posture = useQuery({
    queryKey: ["fdi-posture", code],
    queryFn: () => postureFn({ data: { countryCode: code } }) as Promise<PostureView>,
    staleTime: 60_000,
  });

  const playbooks = useQuery({
    queryKey: ["fdi-playbooks", code, "macro"],
    queryFn: () => listFn({ data: { countryCode: code } }),
    staleTime: 30_000,
  });

  const macroPb = (playbooks.data ?? []).find((p) => p.scope === "macro");

  const generate = useMutation({
    mutationFn: async () => genFn({ data: { countryCode: code, scope: "macro" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fdi-playbooks", code] }),
  });

  if (posture.isLoading) {
    return <div className="p-6 text-sm text-ink-500">Computing FDI posture…</div>;
  }
  if (posture.isError) {
    return <div className="p-6 text-sm text-signal-negative">{(posture.error as Error).message}</div>;
  }
  const p = posture.data!;
  const scoreTone = p.posture_score >= 70 ? "text-emerald-600" : p.posture_score >= 40 ? "text-gold-500" : "text-signal-negative";

  return (
    <div className="space-y-10">
      {/* HERO */}
      <header className="border-b border-line-200 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
          Macro FDI Board · {p.country.name}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
          <div>
            <div className={`font-serif text-[96px] leading-none tracking-tight ${scoreTone}`}>
              {p.posture_score}
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              FDI Posture · 0–100
            </p>
          </div>
          <div className="flex flex-col justify-end space-y-3">
            <h1 className="font-serif text-2xl leading-snug text-ink-950">
              {p.investor_value_prop ?? "Investor value proposition will render here once posture is generated."}
            </h1>
            <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              <span>Concentration {(p.components.concentration * 100).toFixed(0)}</span>
              <span>·</span>
              <span>Diversification {(p.components.diversification * 100).toFixed(0)}</span>
              <span>·</span>
              <span>Pipeline {(p.components.pipeline * 100).toFixed(0)}</span>
              <span>·</span>
              <span>Coverage {(p.components.coverage * 100).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* CAPITAL GAP + PEERS */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="border border-line-200 bg-paper-0 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Capital gap
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="font-serif text-4xl text-ink-950">{fmtUsd(p.capital_gap.gap_usd)}</div>
            <div className="font-mono text-xs text-ink-500">
              {p.capital_gap.gap_pct_gdp != null ? `${p.capital_gap.gap_pct_gdp.toFixed(1)}% of GDP` : "GDP unknown"}
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Current inflow {fmtUsd(p.capital_gap.current_fdi_usd)} vs. target {fmtUsd(p.capital_gap.target_fdi_usd)} — {p.capital_gap.target_basis}.
          </p>
        </div>

        <div className="border border-line-200 bg-paper-0 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Peer benchmark
          </p>
          <table className="mt-3 w-full text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              <tr className="border-b border-line-200">
                <th className="py-1 text-left">Country</th>
                <th className="py-1 text-right">HHI</th>
                <th className="py-1 text-right">Top-1</th>
                <th className="py-1 text-right">FDI/GDP</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line-100 font-medium">
                <td className="py-2">{p.country.name}</td>
                <td className="py-2 text-right tabular-nums">{p.components.hhi.toFixed(3)}</td>
                <td className="py-2 text-right tabular-nums">{p.components.top1_share_pct.toFixed(1)}%</td>
                <td className="py-2 text-right tabular-nums">{p.components.fdi_pct_gdp != null ? `${p.components.fdi_pct_gdp.toFixed(1)}%` : "—"}</td>
              </tr>
              {p.peers.map((peer) => {
                const better = peer.hhi > p.components.hhi;
                return (
                  <tr key={peer.code} className="border-b border-line-100">
                    <td className="py-2 text-ink-700">{peer.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {peer.hhi.toFixed(3)}
                      {better ? (
                        <TrendingUp className="ml-1 inline h-3 w-3 text-emerald-600" />
                      ) : (
                        <TrendingDown className="ml-1 inline h-3 w-3 text-signal-negative" />
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{peer.top1_share_pct.toFixed(1)}%</td>
                    <td className="py-2 text-right tabular-nums">{peer.fdi_pct_gdp != null ? `${peer.fdi_pct_gdp.toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* CONCENTRATION MAP */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Concentration map · GDP share
        </p>
        <div className="mt-3 flex h-16 w-full overflow-hidden border border-line-200">
          {p.sectors.map((s, i) => {
            const color = sectorColor(s.hue_token, i);
            const w = Math.max(2, s.share_pct);
            return (
              <Link
                key={s.code}
                to="/admin/countries/$code/studio/sectors/$sectorCode"
                params={{ code, sectorCode: s.code }}
                title={`${s.label} · ${s.share_pct.toFixed(1)}%`}
                className="group relative border-r border-paper-0/40 last:border-r-0"
                style={{ width: `${w}%`, background: color }}
              >
                <span className="absolute inset-0 hidden items-end p-1 font-mono text-[9px] uppercase tracking-wider text-paper-0 group-hover:flex">
                  {s.code} {s.share_pct.toFixed(0)}%
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ACTIVE TRANSITIONS */}
      {p.active_transitions.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Active transitions</p>
          <ul className="mt-3 divide-y divide-line-100 border border-line-200">
            {p.active_transitions.map((t) => (
              <li key={t.threat_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link
                    to="/admin/countries/$code/studio/threats/$id"
                    params={{ code, id: t.threat_id }}
                    className="text-sm text-ink-950 hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    {t.severity_pct}% severity · {t.ministries_engaged} ministries · {t.status.replace(/_/g, " ")}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-ink-500" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* MACRO PLAYBOOK */}
      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              National FDI transition playbook
            </p>
            <h2 className="mt-1 font-serif text-2xl text-ink-950">30 days → 12 months</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/countries/$code/studio/threats/new"
              params={{ code }}
              className="btn-ghost inline-flex items-center gap-2"
            >
              New threat
            </Link>
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              {generate.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {macroPb ? "Regenerate playbook" : "Generate playbook"}
            </button>
          </div>
        </div>

        {generate.error && (
          <p className="mt-3 text-xs text-signal-negative">{(generate.error as Error).message}</p>
        )}

        {macroPb ? (
          <div className="mt-4">
            <p className="text-sm text-ink-700">{macroPb.summary}</p>
            <div className="mt-4">
              <PlaybookTimeline playbook={macroPb} countryCode={code} />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-500">
            No macro playbook yet. Generate one to see the 30 / 90 / 180 / 365-day ministry-owned rollout.
          </p>
        )}
      </section>
    </div>
  );
}
