// Every sector in one table: its share of GDP, the Scout's call, whether the
// Head of Government has chosen it, and its plan. Choosing and retiring a
// priority are done here; the database caps priorities at four and records
// the reason.

import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { MD_CLASS } from "@/components/egov/SectionEditor";
import type { PlanSummary, SectorSummary } from "@/lib/sector/plan.functions";
import { MAX_PRIORITY_SECTORS } from "@/lib/sector/stages";
import { cn } from "@/lib/utils";

import { FIELD, MICRO, PLAN_META, RECOMMENDATION_META, formatWhen } from "./labels";

type Mode = { sector: string; kind: "brief" | "choose" | "retire" } | null;

export function SectorBoard({
  code,
  sectors,
  plans,
  canChoose,
  onChoose,
  onRetire,
  onStartPlan,
}: {
  code: string;
  sectors: SectorSummary[];
  plans: PlanSummary[];
  canChoose: boolean;
  onChoose: (sector: string, rationale: string, exitRule: string) => Promise<void>;
  onRetire: (sector: string, note: string) => Promise<void>;
  onStartPlan: (sector: SectorSummary) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [exitRule, setExitRule] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = sectors.filter((s) => s.priority?.status === "priority").length;
  const ordered = [...sectors].sort((a, b) => {
    const pa = a.priority?.status === "priority" ? 1 : 0;
    const pb = b.priority?.status === "priority" ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return (b.shortlist?.score ?? -1) - (a.shortlist?.score ?? -1);
  });

  function open(sector: string, kind: "brief" | "choose" | "retire") {
    setError(null);
    setText(
      kind === "choose" ? (sectors.find((s) => s.code === sector)?.shortlist?.headline ?? "") : "",
    );
    setExitRule("");
    setMode(mode?.sector === sector && mode.kind === kind ? null : { sector, kind });
  }

  async function submit() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === "choose") await onChoose(mode.sector, text, exitRule);
      if (mode.kind === "retire") await onRetire(mode.sector, text);
      setMode(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className={MICRO}>Sectors</div>
        <div className="text-xs text-ink-500">
          {active} of {MAX_PRIORITY_SECTORS} priority places taken
        </div>
      </div>
      <table className="w-full border-t border-line-200 text-sm">
        <thead>
          <tr className="text-left">
            {["Sector", "Share of GDP", "Scout", "Priority", "Plan", ""].map((h) => (
              <th key={h} className={cn(MICRO, "border-b border-line-200 py-2 pr-4 font-normal")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((s) => {
            const rec = s.shortlist ? RECOMMENDATION_META[s.shortlist.recommendation] : null;
            const isPriority = s.priority?.status === "priority";
            const plan = plans.find((p) => p.sector_code === s.code && p.status !== "superseded");
            const pm = plan ? PLAN_META[plan.status] : null;
            const openHere = mode?.sector === s.code;
            return (
              <Fragment key={s.code}>
                <tr
                  className={cn(
                    "border-b border-line-200 align-top",
                    isPriority && "border-l-2 border-l-gold-500",
                  )}
                >
                  <td className={cn("py-3 pr-4", isPriority && "pl-3")}>
                    <div className="text-ink-950">{s.label}</div>
                    {s.shortlist?.headline && (
                      <div className="mt-0.5 max-w-md text-xs text-ink-500">
                        {s.shortlist.headline}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs tabular-nums text-ink-700">
                    {s.share_pct != null ? `${s.share_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {rec && s.shortlist ? (
                      <button
                        type="button"
                        className={cn("text-left hover:underline", rec.text)}
                        onClick={() => open(s.code, "brief")}
                        aria-expanded={openHere && mode?.kind === "brief"}
                      >
                        <span
                          className={cn(
                            "mr-1.5 inline-block h-1.5 w-1.5 rounded-full border bg-current",
                            rec.border,
                          )}
                        />
                        {rec.label} · {s.shortlist.score}
                      </button>
                    ) : (
                      <span className="text-ink-400">Not scouted</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {isPriority ? (
                      <span className="text-gold-500">
                        Priority
                        {s.priority?.chosen_at ? (
                          <span className="block text-ink-500">
                            since {formatWhen(s.priority.chosen_at).split(",")[0]}
                          </span>
                        ) : null}
                      </span>
                    ) : s.priority?.status === "retired" ? (
                      <span className="text-ink-400">Retired</span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {plan && pm ? (
                      <Link
                        to="/admin/countries/$code/sector/$planId"
                        params={{ code, planId: plan.id }}
                        className="text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                      >
                        v{plan.version} · <span className={pm.text}>{pm.label}</span>
                        <span className="block text-ink-500">
                          {plan.drafted}/{plan.total} drafted
                          {plan.findings
                            ? ` · ${plan.findings} audit note${plan.findings === 1 ? "" : "s"}`
                            : ""}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {isPriority && !plan && (
                        <button
                          type="button"
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => onStartPlan(s)}
                        >
                          Start plan
                        </button>
                      )}
                      {canChoose && !isPriority && (
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => open(s.code, "choose")}
                        >
                          Choose as priority
                        </button>
                      )}
                      {canChoose && isPriority && (
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => open(s.code, "retire")}
                        >
                          Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {openHere && mode && (
                  <tr className="border-b border-line-200">
                    <td colSpan={6} className="py-4">
                      {mode.kind === "brief" && s.shortlist ? (
                        <div className="border-l-2 border-line-200 pl-4">
                          <div className={MICRO}>Scout's brief · {s.label}</div>
                          <CitedMarkdown
                            source={s.shortlist.brief_md}
                            className={cn(MD_CLASS, "mt-2 text-sm")}
                          />
                          {s.shortlist.citations.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {s.shortlist.citations.map((c) => (
                                <li key={c.key} className="text-xs text-ink-500">
                                  <span className="text-ink-700">{c.label}</span> — {c.why}
                                </li>
                              ))}
                            </ul>
                          )}
                          {s.priority?.rationale && (
                            <p className="mt-3 text-xs text-ink-700">
                              <span className="text-ink-500">Why it is a priority · </span>
                              {s.priority.rationale}
                              {s.priority.exit_rule ? (
                                <>
                                  <span className="text-ink-500"> · Exit rule · </span>
                                  {s.priority.exit_rule}
                                </>
                              ) : null}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="max-w-2xl border-l-2 border-gold-500 pl-4">
                          <div className={MICRO}>
                            {mode.kind === "choose"
                              ? `Choose ${s.label} as a national priority`
                              : `Retire ${s.label} as a priority`}
                          </div>
                          <label className="mt-2 block">
                            <span className="text-xs text-ink-500">
                              {mode.kind === "choose"
                                ? "Why this sector (recorded in the audit log)"
                                : "Why it is being retired"}
                            </span>
                            <textarea
                              className={cn(FIELD, "mt-1 min-h-20")}
                              value={text}
                              onChange={(e) => setText(e.target.value)}
                              maxLength={2000}
                            />
                          </label>
                          {mode.kind === "choose" && (
                            <label className="mt-3 block">
                              <span className="text-xs text-ink-500">
                                Exit rule — when would this sector be retired? (optional)
                              </span>
                              <input
                                className={cn(FIELD, "mt-1")}
                                value={exitRule}
                                onChange={(e) => setExitRule(e.target.value)}
                                maxLength={1000}
                                placeholder="e.g. no growth in value added for two consecutive years"
                              />
                            </label>
                          )}
                          {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="btn-primary px-3 py-1.5 text-xs"
                              disabled={busy || text.trim().length < 10}
                              onClick={submit}
                            >
                              {busy ? "Saving…" : mode.kind === "choose" ? "Choose" : "Retire"}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost px-3 py-1.5 text-xs"
                              onClick={() => setMode(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
