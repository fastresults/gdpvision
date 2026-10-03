// Chamber 07 · Ministers track — the Ideal Minister Profile, read and edit.
// Personality bands over the cast's spread, the tiered skill stack, the
// decision model (one section per decision class), anti-patterns, stress
// behaviours, country deltas (overlays), the cited narrative, and the
// citations. Editing is in place; the edit is recorded on the synthesis.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/ministers-entries";
import {
  SKILL_TIER_LABEL,
  type Aggregates,
  type IdealProfile,
  type SkillRow,
  type SkillTier,
  type SynthesisRow,
} from "@/lib/personas/portfolio/db";
import { savePortfolioProfile } from "@/lib/personas/portfolio/studio.functions";
import { cn } from "@/lib/utils";

import { OceanBands } from "./Charts";
import { FIELD, MICRO, formatWhen } from "./labels";

const TIERS: SkillTier[] = ["must_have", "should_have", "differentiator"];

/** Renders [key] citation markers as superscript references. */
function CitedText({ text, cites }: { text: string; cites: SynthesisRow["citations"] }) {
  const idx = new Map(cites.map((c, i) => [c.key, i + 1]));
  const parts = text.split(/(\[[a-z0-9_.-]+\])/gi);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([a-z0-9_.-]+)\]$/i);
        if (!m) return <span key={i}>{p}</span>;
        const n = idx.get(m[1]!);
        return n ? (
          <sup key={i} className="ml-0.5 font-mono text-[9px] text-gold-500">
            <a href={`#cite-${n}`}>{n}</a>
          </sup>
        ) : null;
      })}
    </>
  );
}

function Narrative({ md, cites }: { md: string; cites: SynthesisRow["citations"] }) {
  const blocks = md
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-950">
      {blocks.map((b, i) => {
        if (/^#{1,6}\s/.test(b))
          return (
            <h4 key={i} className="pt-2 font-serif text-base text-ink-950">
              {b.replace(/^#{1,6}\s/, "")}
            </h4>
          );
        if (/^[-*]\s/m.test(b))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.split("\n").map((l, j) => (
                <li key={j}>
                  <CitedText text={l.replace(/^[-*]\s/, "")} cites={cites} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            <CitedText text={b.replace(/\*\*(.+?)\*\*/g, "$1")} cites={cites} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * One item per line. Keeps the raw text while typing (so spaces and new
 * lines are not undone), and hands the parsed list up on every change.
 */
function ListField({
  value,
  onChange,
  label,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(value.join("\n"));
  return (
    <textarea
      className={cn(FIELD, className)}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(lines(e.target.value));
      }}
      aria-label={label}
    />
  );
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function IdealProfileView({
  synthesis,
  aggregates,
  skills,
  canEdit,
  onSaved,
  overlay,
}: {
  synthesis: SynthesisRow;
  aggregates: Aggregates | null;
  skills: SkillRow[];
  canEdit: boolean;
  onSaved: () => void;
  overlay: boolean;
}) {
  const save = useServerFn(savePortfolioProfile);
  const profile = synthesis.profile as IdealProfile;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<IdealProfile>(profile);
  const [narrative, setNarrative] = useState(synthesis.narrative_md);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.code, s])), [skills]);
  const p = editing ? draft : profile;

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      await save({ data: { setId: synthesis.set_id, profile: draft, narrative_md: narrative } });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const list = (k: "values" | "anti_patterns" | "stress_behaviours", label: string) => (
    <div>
      <div className={MICRO}>{label}</div>
      {editing ? (
        <ListField
          className="mt-1 min-h-28 text-xs"
          value={draft[k]}
          onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
          label={label}
        />
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-ink-700">
          {p[k].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {editing ? (
            <>
              <input
                className={cn(FIELD, "font-serif text-xl")}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label="Title"
              />
              <textarea
                className={cn(FIELD, "mt-2 min-h-24")}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                aria-label="Summary"
              />
            </>
          ) : (
            <>
              <h2 className="font-serif text-2xl leading-tight text-ink-950">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{p.summary}</p>
            </>
          )}
          {synthesis.edited_at && (
            <p className="mt-1 text-[11px] text-ink-400">
              Edited {formatWhen(synthesis.edited_at)}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => {
                    setEditing(false);
                    setDraft(profile);
                    setNarrative(synthesis.narrative_md);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={saving}
                  onClick={onSave}
                >
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
          </div>
        )}
      </header>
      {err && (
        <p className="border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {err}
        </p>
      )}

      {overlay && !!p.country_deltas?.length && (
        <section>
          <div className={MICRO}>
            <Explain id="ministers.overlay">Country deltas</Explain>
          </div>
          <table className="mt-2 w-full border-t border-line-200 text-xs">
            <tbody>
              {p.country_deltas.map((d, i) => (
                <tr key={i} className="border-b border-line-200 align-top">
                  <td className="w-40 py-2 pr-3 text-ink-950">{d.aspect}</td>
                  <td className="py-2 pr-3 text-ink-700">{d.change}</td>
                  <td className="py-2 text-ink-500">{d.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className={MICRO}>
            <Explain id="ministers.ocean.band">Personality</Explain>
          </div>
          <div className="mt-3">
            {aggregates ? (
              <OceanBands aggregates={aggregates} profile={p} />
            ) : (
              <p className="text-xs text-ink-500">No count available.</p>
            )}
          </div>
          {editing && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {(
                Object.keys(draft.personality.ocean_target) as Array<
                  keyof IdealProfile["personality"]["ocean_target"]
                >
              ).map((k) => (
                <label key={k} className="text-[10px] text-ink-500">
                  {k}
                  <div className="mt-0.5 flex gap-1">
                    {(["low", "high"] as const).map((e) => (
                      <input
                        key={e}
                        type="number"
                        min={0}
                        max={100}
                        className={cn(FIELD, "px-1 py-0.5 text-xs")}
                        value={draft.personality.ocean_target[k][e]}
                        onChange={(ev) =>
                          setDraft({
                            ...draft,
                            personality: {
                              ...draft.personality,
                              ocean_target: {
                                ...draft.personality.ocean_target,
                                [k]: {
                                  ...draft.personality.ocean_target[k],
                                  [e]: Number(ev.target.value),
                                },
                              },
                            },
                          })
                        }
                        aria-label={`${k} ${e}`}
                      />
                    ))}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className={MICRO}>Traits</div>
          {editing ? (
            <ListField
              className="mt-1 min-h-32 text-xs"
              value={draft.personality.traits}
              onChange={(v) =>
                setDraft((d) => ({ ...d, personality: { ...d.personality, traits: v } }))
              }
              label="Traits"
            />
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-ink-950">
              {p.personality.traits.map((t) => (
                <li key={t} className="border-l-2 border-line-200 pl-3">
                  {t}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5">{list("values", "Values")}</div>
        </div>
      </section>

      <section>
        <div className={MICRO}>
          <Explain id="ministers.skill.weight">The skill stack</Explain>
        </div>
        <div className="mt-3 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier}
              className={cn(
                "border-t-2 pt-2",
                tier === "must_have"
                  ? "border-ink-950"
                  : tier === "should_have"
                    ? "border-ink-500"
                    : "border-gold-500",
              )}
            >
              <div className="text-xs text-ink-950">{SKILL_TIER_LABEL[tier]}</div>
              <ul className="mt-2 space-y-2">
                {p.skill_stack
                  .filter((s) => s.tier === tier)
                  .map((s) => {
                    const a = aggregates?.skills.find((x) => x.code === s.code);
                    return (
                      <li key={s.code} className="text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-ink-950">
                            {skillMap.get(s.code)?.label ?? s.code}
                          </span>
                          {a && (
                            <span
                              className="font-mono text-[10px] text-ink-400"
                              title="held by / mean proficiency"
                            >
                              {a.count}/{aggregates!.personas} · {a.mean_proficiency.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {editing ? (
                          <select
                            className={cn(FIELD, "mt-1 py-0.5 text-[11px]")}
                            value={s.tier}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                skill_stack: draft.skill_stack.map((x) =>
                                  x.code === s.code
                                    ? { ...x, tier: e.target.value as SkillTier }
                                    : x,
                                ),
                              })
                            }
                            aria-label={`Tier for ${s.code}`}
                          >
                            {TIERS.map((t) => (
                              <option key={t} value={t}>
                                {SKILL_TIER_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-[11px] text-ink-500">{s.why}</div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className={MICRO}>
          <Explain id="ministers.profile.decision">
            How the ideal holder of this office decides
          </Explain>
        </div>
        <div className="mt-3 divide-y divide-line-200 border-y border-line-200">
          {p.decision_model.map((d, i) => (
            <details key={d.key} className="group py-3" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                <span className="font-serif text-[15px] text-ink-950">{d.label}</span>
                <span className="text-[11px] text-ink-500">
                  {d.horizon} · {d.risk_posture}
                </span>
              </summary>
              <div className="mt-3 grid gap-4 text-xs md:grid-cols-[1fr_1fr]">
                <div>
                  <div className="text-ink-500">Weighs, in order</div>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-ink-950">
                    {d.weighs.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ol>
                  <div className="mt-3 text-ink-500">Consults</div>
                  <div className="mt-1 text-ink-950">{d.consults.join("; ")}</div>
                </div>
                <div>
                  <div className="text-ink-500">Says no when</div>
                  {editing ? (
                    <textarea
                      className={cn(FIELD, "mt-1 min-h-16 text-xs")}
                      value={draft.decision_model[i]?.says_no_when ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          decision_model: draft.decision_model.map((x, j) =>
                            j === i ? { ...x, says_no_when: e.target.value } : x,
                          ),
                        })
                      }
                      aria-label={`Says no when — ${d.label}`}
                    />
                  ) : (
                    <div className="mt-1 border-l-2 border-signal-negative pl-2 text-ink-950">
                      {d.says_no_when}
                    </div>
                  )}
                  {editing ? (
                    <textarea
                      className={cn(FIELD, "mt-3 min-h-24 text-xs")}
                      value={draft.decision_model[i]?.narrative ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          decision_model: draft.decision_model.map((x, j) =>
                            j === i ? { ...x, narrative: e.target.value } : x,
                          ),
                        })
                      }
                      aria-label={`Narrative — ${d.label}`}
                    />
                  ) : (
                    <p className="mt-3 leading-relaxed text-ink-700">{d.narrative}</p>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        {list("anti_patterns", "What goes wrong in this office")}
        {list("stress_behaviours", "Under pressure")}
      </section>

      <section>
        <div className={MICRO}>The profile in prose</div>
        <div className="mt-3 max-w-3xl">
          {editing ? (
            <textarea
              className={cn(FIELD, "min-h-72 text-sm")}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              aria-label="Narrative"
            />
          ) : (
            <Narrative md={synthesis.narrative_md} cites={synthesis.citations} />
          )}
        </div>
      </section>

      {!!synthesis.citations.length && (
        <section>
          <div className={MICRO}>Sources</div>
          <ol className="mt-2 space-y-1 text-[11px]">
            {synthesis.citations.map((c, i) => (
              <li
                key={`${c.key}-${i}`}
                id={`cite-${i + 1}`}
                className="grid grid-cols-[24px_1fr] gap-2"
              >
                <span className="font-mono text-ink-400">{i + 1}</span>
                <span>
                  {/^https?:/.test(c.ref) ? (
                    <a
                      href={c.ref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-950 underline decoration-line-200 underline-offset-2"
                    >
                      {c.label}
                    </a>
                  ) : (
                    <span className="text-ink-950">{c.label}</span>
                  )}
                  <span className="text-ink-500"> — {c.why}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
