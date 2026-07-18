import { Plus, Sparkles, Trash2 } from "lucide-react";

import type { ActionType, ResilienceAction } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";
import { ExplainHover } from "./ExplainHover";
import { EXPLAIN } from "./explain-copy";

type Sector = { code: string; label: string; hue_token?: string | null };
type Ministry = { slug: string; name: string };

const ACTION_TYPES: Array<{ key: ActionType; label: string }> = [
  { key: "attract_new_fdi", label: "Attract new FDI" },
  { key: "expand_existing", label: "Expand existing" },
  { key: "retain_at_risk", label: "Retain at risk" },
  { key: "substitute_domestic", label: "Substitute domestic" },
  { key: "exit_wind_down", label: "Exit / wind down" },
];

function newAction(sector: string): ResilienceAction {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `a_${Date.now()}`,
    sector_code: sector,
    action_type: "attract_new_fdi",
    label: "New action",
    target_pp: 1,
    staging_year: 0,
    sponsor_ministry_slug: null,
  };
}

export function ResilienceActionsRail({
  actions,
  onChange,
  sectors,
  ministries,
  horizon,
}: {
  actions: ResilienceAction[];
  onChange: (next: ResilienceAction[]) => void;
  sectors: Sector[];
  ministries: Ministry[];
  horizon: number;
}) {
  const bySector = new Map(sectors.map((s, i) => [s.code, { s, i }]));

  function update(id: string, patch: Partial<ResilienceAction>) {
    onChange(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function remove(id: string) {
    onChange(actions.filter((a) => a.id !== id));
  }
  function add() {
    onChange([...actions, newAction(sectors[0]?.code ?? "TOURISM")]);
  }

  return (
    <div className="border border-line-200 bg-paper-0">
      <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
        <ExplainHover copy={EXPLAIN.actions_rail} side="left">
          <p className="cursor-help font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline decoration-dotted decoration-line-200 underline-offset-4">
            Resilience actions
          </p>
        </ExplainHover>
        <ExplainHover copy={EXPLAIN.action_add} side="left">
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
          >
            <Plus size={12} /> Add
          </button>
        </ExplainHover>
      </div>
      <ul className="divide-y divide-line-200">
        {actions.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-500">
            No actions yet — run “Suggest resilient allocation” or add manually.
          </li>
        )}
        {actions.map((a) => {
          const meta = bySector.get(a.sector_code);
          const color = sectorColor(meta?.s.hue_token, meta?.i ?? 0);
          return (
            <li key={a.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 flex-none"
                  style={{ background: color }}
                />
                <input
                  value={a.label}
                  onChange={(e) => update(a.id, { label: e.target.value })}
                  title={a.label}
                  className="min-w-0 flex-1 border-b border-line-200 bg-transparent py-0.5 text-sm text-ellipsis focus:border-ink-950 focus:outline-none"
                />
                {a.ai_generated && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 border border-line-200 bg-paper-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-500">
                    <Sparkles size={10} /> AI
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="shrink-0 text-ink-500 hover:text-rose-600"
                  aria-label="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="Sector">
                  <select
                    value={a.sector_code}
                    onChange={(e) => update(a.id, { sector_code: e.target.value })}
                    className="w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none"
                  >
                    {sectors.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <select
                    value={a.action_type}
                    onChange={(e) => update(a.id, { action_type: e.target.value as ActionType })}
                    className="w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none"
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Target">
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={a.target_pp}
                      onChange={(e) => update(a.id, { target_pp: Number(e.target.value) })}
                      className="w-full border-b border-line-200 bg-transparent py-1 text-right tabular-nums focus:border-ink-950 focus:outline-none"
                    />
                    <span className="font-mono text-[10px] text-ink-500">pp</span>
                  </div>
                </Field>
                <Field label="Year">
                  <select
                    value={a.staging_year}
                    onChange={(e) => update(a.id, { staging_year: Number(e.target.value) })}
                    className="w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none"
                  >
                    {Array.from({ length: horizon }, (_, i) => i + 1).map((y) => (
                      <option key={y} value={y}>
                        Y{y}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sponsor" className="col-span-2">
                  <select
                    value={a.sponsor_ministry_slug ?? ""}
                    onChange={(e) =>
                      update(a.id, {
                        sponsor_ministry_slug: e.target.value || null,
                      })
                    }
                    className={cn(
                      "w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none",
                      !a.sponsor_ministry_slug && "text-ink-500",
                    )}
                  >
                    <option value="">— assign ministry —</option>
                    {ministries.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}
