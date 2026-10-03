// Chamber 07 · Ministers track — the cast. Fifty cards, filterable by any
// matrix axis and sortable by any skill; a card opens a drawer with the full
// persona, its skills with proficiency and rationale, OCEAN, decision style,
// the matrix cell it was cast for, the quality check, and its citations.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  OCEAN_KEYS,
  OCEAN_LABEL,
  STYLE_KEYS,
  STYLE_LABEL,
  type MatrixAxis,
  type PersonaRow,
  type SkillRow,
} from "@/lib/personas/portfolio/db";
import { regeneratePersonaSlot } from "@/lib/personas/portfolio/run.functions";
import { cn } from "@/lib/utils";

import { FIELD, MICRO } from "./labels";

function Dots({ n, of = 5 }: { n: number; of?: number }) {
  return (
    <span className="inline-flex gap-[2px]" aria-label={`${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full border",
            i < n ? "border-ink-950 bg-ink-950" : "border-line-200",
          )}
        />
      ))}
    </span>
  );
}

export function PersonaDrawer({
  persona,
  skills,
  axes,
  canRegenerate,
  onClose,
  onRegenerated,
}: {
  persona: PersonaRow | null;
  skills: Map<string, SkillRow>;
  axes: MatrixAxis[];
  canRegenerate: boolean;
  onClose: () => void;
  onRegenerated: () => void;
}) {
  const regen = useServerFn(regeneratePersonaSlot);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = persona;
  return (
    <Sheet open={!!p} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-paper-0 sm:max-w-xl">
        {p && (
          <>
            <SheetHeader>
              <div className={MICRO}>Persona {p.slot_index}</div>
              <SheetTitle className="font-serif text-2xl text-ink-950">{p.name}</SheetTitle>
              <p className="text-sm text-ink-700">{p.archetype}</p>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-8">
              {(p.qa?.notes?.length ?? 0) > 0 && (
                <div
                  className={cn(
                    "border-l-2 py-1 pl-3 text-xs",
                    p.qa?.ok === false
                      ? "border-signal-negative text-signal-negative"
                      : "border-signal-caution text-ink-700",
                  )}
                >
                  {p.qa?.ok === false && <div className="mb-1">Left out of the count.</div>}
                  {p.qa!.notes!.map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
              )}
              <p className="text-sm leading-relaxed text-ink-950">{p.summary}</p>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {(
                  [
                    ["Route to office", p.career_route],
                    ["Age", p.attributes?.age_band],
                    ["Formation", p.attributes?.formation],
                    ["Constituency", p.attributes?.constituency],
                    ["Political capital", p.attributes?.political_capital],
                    ["Network", p.attributes?.network],
                  ] as const
                ).map(([k, v]) =>
                  v ? (
                    <div key={k}>
                      <dt className="text-ink-500">{k}</dt>
                      <dd className="text-ink-950">{v}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {!!p.attributes?.prior_roles?.length && (
                <div>
                  <div className={MICRO}>Prior roles</div>
                  <ul className="mt-1 list-disc pl-4 text-xs text-ink-700">
                    {p.attributes.prior_roles.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!p.attributes?.signature_moves?.length && (
                <div>
                  <div className={MICRO}>Signature moves</div>
                  <ul className="mt-1 list-disc pl-4 text-xs text-ink-700">
                    {p.attributes.signature_moves.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className={MICRO}>Skills</div>
                <ul className="mt-2 space-y-1.5">
                  {[...(p.skills ?? [])]
                    .sort((a, b) => b.proficiency - a.proficiency)
                    .map((s) => (
                      <li key={s.code} className="grid grid-cols-[1fr_auto] gap-2 text-xs">
                        <div>
                          <div className="text-ink-950">{skills.get(s.code)?.label ?? s.code}</div>
                          <div className="text-[11px] text-ink-500">{s.rationale}</div>
                        </div>
                        <Dots n={s.proficiency} />
                      </li>
                    ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className={MICRO}>Personality (0–100)</div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {OCEAN_KEYS.map((k) => (
                      <li key={k} className="flex justify-between">
                        <span className="text-ink-700">{OCEAN_LABEL[k]}</span>
                        <span className="font-mono tabular-nums text-ink-950">
                          {p.ocean?.[k] ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className={MICRO}>Decision style (1–5)</div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {STYLE_KEYS.map((k) => (
                      <li
                        key={k}
                        className="flex items-center justify-between"
                        title={`${STYLE_LABEL[k].low} → ${STYLE_LABEL[k].high}`}
                      >
                        <span className="text-ink-700">{STYLE_LABEL[k].label}</span>
                        <Dots n={p.decision_style?.[k] ?? 0} />
                      </li>
                    ))}
                  </ul>
                  {p.decision_style?.style && (
                    <p className="mt-1 text-[11px] italic text-ink-500">{p.decision_style.style}</p>
                  )}
                </div>
              </div>
              <div>
                <div className={MICRO}>Cast for</div>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {axes.map((a) => (
                    <div key={a.key}>
                      <dt className="text-ink-500">{a.label}</dt>
                      <dd className="text-ink-950">{p.matrix_cell?.[a.key] ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {!!p.citations?.length && (
                <div>
                  <div className={MICRO}>Grounded in</div>
                  <ol className="mt-1 space-y-1 text-[11px]">
                    {p.citations.map((c) => (
                      <li key={c.key}>
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
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {err && <p className="text-xs text-signal-negative">{err}</p>}
              {canRegenerate && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    try {
                      await regen({ data: { setId: p.set_id, slot: p.slot_index } });
                      onRegenerated();
                      onClose();
                    } catch (e) {
                      setErr((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Clearing…" : "Regenerate this persona"}
                </button>
              )}
              {canRegenerate && (
                <p className="text-[11px] text-ink-500">
                  Regenerating sends the run back to casting; the count and the profile are redone
                  when it finishes.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PersonaGrid({
  personas,
  skills,
  axes,
  canRegenerate,
  onChanged,
  focusSkill,
}: {
  personas: PersonaRow[];
  skills: SkillRow[];
  axes: MatrixAxis[];
  canRegenerate: boolean;
  onChanged: () => void;
  focusSkill?: string | null;
}) {
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.code, s])), [skills]);
  const [axis, setAxis] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [sortSkill, setSortSkill] = useState<string>(focusSkill ?? "");
  const [open, setOpen] = useState<PersonaRow | null>(null);
  const [flagged, setFlagged] = useState(false);

  const effectiveSort = focusSkill ?? sortSkill;
  const values = axis
    ? [...new Set(personas.map((p) => p.matrix_cell?.[axis]).filter(Boolean))]
    : [];
  const prof = (p: PersonaRow, code: string) =>
    p.skills?.find((s) => s.code === code)?.proficiency ?? 0;
  const shown = personas
    .filter((p) => !axis || !value || p.matrix_cell?.[axis] === value)
    .filter((p) => !flagged || p.qa?.ok === false || p.qa?.real_person_flag)
    .filter((p) => !effectiveSort || prof(p, effectiveSort) > 0 || !focusSkill)
    .sort((a, b) =>
      effectiveSort ? prof(b, effectiveSort) - prof(a, effectiveSort) : a.slot_index - b.slot_index,
    );

  if (!personas.length)
    return <p className="text-sm text-ink-500">No personas yet. Start the run to cast them.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-700">
          <span className="block text-ink-500">Filter by</span>
          <select
            className={cn(FIELD, "mt-1 py-1 text-xs")}
            value={axis}
            onChange={(e) => {
              setAxis(e.target.value);
              setValue("");
            }}
          >
            <option value="">— everyone —</option>
            {axes.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {axis && (
          <label className="text-xs text-ink-700">
            <span className="block text-ink-500">Value</span>
            <select
              className={cn(FIELD, "mt-1 py-1 text-xs")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">— any —</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        {!focusSkill && (
          <label className="text-xs text-ink-700">
            <span className="block text-ink-500">Sort by skill</span>
            <select
              className={cn(FIELD, "mt-1 py-1 text-xs")}
              value={sortSkill}
              onChange={(e) => setSortSkill(e.target.value)}
            >
              <option value="">— slot order —</option>
              {skills.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1.5 pb-1 text-xs text-ink-700">
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />{" "}
          Flagged only
        </label>
        <span className="pb-1 text-xs text-ink-500">{shown.length} shown</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            className={cn(
              "btn-ghost flex h-full flex-col items-start border p-3 text-left",
              p.qa?.ok === false
                ? "border-signal-negative"
                : "border-line-200 hover:border-ink-950",
            )}
          >
            <div className="flex w-full items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] text-ink-400">#{p.slot_index}</span>
              {(p.qa?.real_person_flag || p.qa?.ok === false) && (
                <span className="inline-flex items-center gap-1 text-[10px] text-signal-negative">
                  <AlertTriangle size={10} /> flagged
                </span>
              )}
              {effectiveSort && (
                <span className="text-[10px] text-ink-500">
                  {skillMap.get(effectiveSort)?.label}: <Dots n={prof(p, effectiveSort)} />
                </span>
              )}
            </div>
            <div className="mt-1 font-serif text-[15px] leading-tight text-ink-950">{p.name}</div>
            <div className="text-[11px] text-ink-700">{p.archetype}</div>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-ink-500">{p.summary}</p>
            <div className="mt-2 text-[10px] text-ink-400">
              {p.career_route}
              {p.decision_style?.style ? ` · ${p.decision_style.style}` : ""}
            </div>
          </button>
        ))}
      </div>
      <PersonaDrawer
        persona={open}
        skills={skillMap}
        axes={axes}
        canRegenerate={canRegenerate}
        onClose={() => setOpen(null)}
        onRegenerated={onChanged}
      />
    </div>
  );
}
