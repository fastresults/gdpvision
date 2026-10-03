// Chamber 07 · Ministers track — workspace panels: Skills, Cabinet weighting
// (Prime Minister), Convene, the approval bar, and the proposed-skills tray.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/ministers-entries";
import {
  SKILL_FAMILY_LABEL,
  type Aggregates,
  type IdealProfile,
  type PersonaRow,
  type SetRow,
  type SkillRow,
} from "@/lib/personas/portfolio/db";
import { convene, type ConveneResult } from "@/lib/personas/portfolio/convene.functions";
import {
  promoteProposedSkill,
  transitionPortfolioSet,
  type PmInput,
  type WorkspaceData,
} from "@/lib/personas/portfolio/studio.functions";
import { cn } from "@/lib/utils";

import { SkillBars, SkillHeat, StyleBands } from "./Charts";
import { FIELD, MICRO, STATUS_META, formatWhen } from "./labels";

// ------------------------------------------------------------------ skills

export function SkillsPanel({
  aggregates,
  skills,
  personas,
  profile,
  onPickSkill,
}: {
  aggregates: Aggregates | null;
  skills: SkillRow[];
  personas: PersonaRow[];
  profile: IdealProfile | null;
  onPickSkill: (code: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const labels = useMemo(
    () => new Map(skills.map((s) => [s.code, { label: s.label, family: s.family }])),
    [skills],
  );
  const inStack = useMemo(() => new Set(profile?.skill_stack.map((s) => s.code) ?? []), [profile]);
  if (!aggregates)
    return (
      <p className="text-sm text-ink-500">
        The skills are counted once the cast has passed the quality check.
      </p>
    );
  const holders = picked
    ? personas
        .map((p) => ({ p, s: p.skills?.find((x) => x.code === picked) }))
        .filter((x) => x.s)
        .sort((a, b) => b.s!.proficiency - a.s!.proficiency)
    : [];
  const pick = (code: string) => setPicked(code);
  return (
    <div className="grid gap-10 xl:grid-cols-[1.1fr_1fr]">
      <div>
        <div className={MICRO}>
          <Explain id="ministers.skill.weight">Skills by weight</Explain>
        </div>
        <p className="mt-1 text-[11px] text-ink-500">
          {aggregates.personas} personas counted. Right: held by / mean proficiency.
          {profile ? " Gold: in the Ideal Profile's stack." : ""}
        </p>
        <div className="mt-3">
          <SkillBars
            skills={aggregates.skills}
            personas={aggregates.personas}
            highlight={inStack}
            onPick={pick}
            limit={25}
          />
        </div>
      </div>
      <div className="space-y-8">
        <div>
          <div className={MICRO}>Coverage by family</div>
          <div className="mt-3">
            <SkillHeat aggregates={aggregates} skillLabels={labels} onPick={pick} />
          </div>
        </div>
        <div>
          <div className={MICRO}>How the cast decides</div>
          <div className="mt-3">
            <StyleBands aggregates={aggregates} />
          </div>
        </div>
        {picked && (
          <div className="border-l-2 border-gold-500 pl-3">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-ink-950">{labels.get(picked)?.label}</div>
              <button
                type="button"
                className="btn-ghost px-2 py-0.5 text-[11px]"
                onClick={() => onPickSkill(picked)}
              >
                Show in cast
              </button>
            </div>
            <div className="text-[11px] text-ink-500">
              {SKILL_FAMILY_LABEL[labels.get(picked)?.family as keyof typeof SKILL_FAMILY_LABEL]} ·{" "}
              {skills.find((s) => s.code === picked)?.definition}
            </div>
            <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {holders.map(({ p, s }) => (
                <li key={p.id} className="text-[11px]">
                  <span className="text-ink-950">
                    #{p.slot_index} {p.name}
                  </span>{" "}
                  <span className="font-mono text-ink-400">{s!.proficiency}/5</span>
                  <div className="text-ink-500">{s!.rationale}</div>
                </li>
              ))}
              {!holders.length && (
                <li className="text-[11px] text-ink-500">No persona holds this skill.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProposedSkills({
  set,
  canPromote,
  onChanged,
}: {
  set: SetRow;
  canPromote: boolean;
  onChanged: () => void;
}) {
  const promote = useServerFn(promoteProposedSkill);
  const [err, setErr] = useState<string | null>(null);
  const items = set.proposed_skills ?? [];
  if (!items.length) return null;
  return (
    <div className="mt-10">
      <div className={MICRO}>Skills the cast needed that the taxonomy lacks</div>
      <p className="mt-1 text-[11px] text-ink-500">
        Proposed by the model while casting. Promote one and it can be used by every profile from
        the next run.
      </p>
      {err && <p className="mt-2 text-xs text-signal-negative">{err}</p>}
      <ul className="mt-2 divide-y divide-line-200 border-y border-line-200">
        {items.map((s) => (
          <li key={s.label} className="flex items-start justify-between gap-3 py-2 text-xs">
            <div>
              <span className="text-ink-950">{s.label}</span>{" "}
              <span className="text-ink-500">
                · {SKILL_FAMILY_LABEL[s.family]} · personas {s.slots.join(", ")}
              </span>
              <div className="text-[11px] text-ink-500">{s.definition}</div>
            </div>
            {canPromote && (
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-1 text-[11px]"
                onClick={async () => {
                  setErr(null);
                  try {
                    await promote({
                      data: {
                        setId: set.id,
                        label: s.label,
                        family: s.family,
                        definition: s.definition,
                      },
                    });
                    onChanged();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                Add to taxonomy
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ PM

export function CabinetWeighting({
  profile,
  inputs,
  portfolios,
  stale,
  code,
}: {
  profile: IdealProfile | null;
  inputs: PmInput[];
  portfolios: WorkspaceData["portfolios"];
  stale: boolean;
  code: string;
}) {
  const label = new Map(portfolios.map((p) => [p.code, p.label]));
  const w = [...(profile?.portfolio_weighting ?? [])].sort((a, b) => b.weight - a.weight);
  return (
    <div className="space-y-6">
      <div>
        <div className={MICRO}>
          <Explain id="ministers.pm.weighting">The Cabinet weighting</Explain>
        </div>
        <p className="mt-1 max-w-3xl text-[12px] text-ink-700">
          How the ideal Prime Minister weighs each portfolio's claims when the fiscal envelope is
          fixed — built from the approved Ideal Minister Profiles below.
        </p>
      </div>
      {stale && (
        <p className="border-l-2 border-signal-caution py-1 pl-3 text-xs text-ink-700">
          Out of date: a portfolio profile has been approved since this weighting was written.
          Reopen the profile if needed and choose “Synthesise again” to bring it in.
        </p>
      )}
      {w.length ? (
        <table className="w-full border-t border-line-200 text-xs">
          <thead>
            <tr className="text-left">
              {["Portfolio", "Weight", "Stance", "How the PM arbitrates its claims"].map((h) => (
                <th key={h} className={cn(MICRO, "border-b border-line-200 py-2 pr-4 font-normal")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {w.map((x) => (
              <tr key={x.portfolio_code} className="border-b border-line-200 align-top">
                <td className="py-2 pr-4 text-ink-950">
                  {label.get(x.portfolio_code) ?? x.portfolio_code}
                </td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-2" title={`${x.weight} of 5`}>
                    <span className="relative h-2 w-20 border border-line-200">
                      <span
                        className="absolute inset-y-0 left-0 bg-ink-950"
                        style={{ width: `${(x.weight / 5) * 100}%` }}
                      />
                    </span>
                    <span className="font-mono tabular-nums text-ink-700">{x.weight}</span>
                  </span>
                </td>
                <td className="py-2 pr-4 text-ink-700">{x.stance}</td>
                <td className="py-2 text-ink-700">{x.arbitration_rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-500">
          The weighting is written when the profile is synthesised.
        </p>
      )}
      <div>
        <div className={MICRO}>Approved portfolio profiles in this scope</div>
        <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {inputs.map((i) => (
            <li key={i.synthesis_id} className="border border-line-200 p-2 text-xs">
              <Link
                to="/admin/countries/$code/personas/portfolios/$setId"
                params={{ code, setId: i.set_id }}
                className="text-ink-950 underline decoration-line-200 underline-offset-2"
              >
                {i.label} v{i.version}
              </Link>
              <div className="text-[11px] text-ink-500">
                Approved {formatWhen(i.approved_at)}
                {i.used ? " · used" : " · not yet used"}
                {i.newer ? " · newer than the PM profile" : ""}
              </div>
            </li>
          ))}
          {!inputs.length && <li className="text-xs text-ink-500">None approved yet.</li>}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ convene

export function ConvenePanel({
  code,
  portfolios,
  defaults,
}: {
  code: string;
  portfolios: WorkspaceData["portfolios"];
  defaults: string[];
}) {
  const run = useServerFn(convene);
  const [chosen, setChosen] = useState<string[]>(defaults.filter((d) => d !== "PM"));
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ConveneResult | null>(null);
  const ministries = portfolios.filter((p) => p.kind === "ministry");
  return (
    <div className="space-y-6">
      <div>
        <div className={MICRO}>Convene</div>
        <p className="mt-1 max-w-3xl text-[12px] text-ink-700">
          Put one question to the ideal ministers of the portfolios you choose; each answers from
          their profile, and the ideal Prime Minister arbitrates. A rehearsal to test an argument
          before it reaches Cabinet — never advice, never a decision.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ministries.map((p) => {
          const on = chosen.includes(p.code);
          return (
            <button
              key={p.code}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setChosen(on ? chosen.filter((c) => c !== p.code) : [...chosen, p.code].slice(0, 8))
              }
              className={cn(
                "border px-2 py-1 text-[11px]",
                on
                  ? "border-ink-950 text-ink-950"
                  : "border-line-200 text-ink-500 hover:text-ink-950",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <textarea
        className={cn(FIELD, "min-h-24")}
        placeholder="e.g. Should we guarantee a new direct route from Toronto at US$4m a year while the hospital wing is unfunded?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        aria-label="Question for the ideal Cabinet"
      />
      <button
        type="button"
        className="btn-primary px-3 py-1.5 text-xs"
        disabled={busy || chosen.length === 0 || question.trim().length < 10}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            setRes(await run({ data: { code, portfolios: chosen, question } }));
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Convening…" : "Convene"}
      </button>
      {err && (
        <p className="border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {err}
        </p>
      )}
      {res && (
        <div className="space-y-5">
          {!!res.missing.length && (
            <p className="text-xs text-ink-500">No profile yet for: {res.missing.join(", ")}.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {res.positions.map((p) => (
              <article key={p.portfolio_code} className="border border-line-200 p-3">
                <div className={MICRO}>
                  {p.label}
                  {!p.approved && <span className="ml-1 text-signal-caution">· draft profile</span>}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-950">{p.position}</p>
                {!!p.weighs.length && (
                  <div className="mt-2 text-[11px] text-ink-700">Weighs: {p.weighs.join("; ")}</div>
                )}
                {!!p.red_lines.length && (
                  <div className="mt-1 border-l-2 border-signal-negative pl-2 text-[11px] text-ink-700">
                    Red lines: {p.red_lines.join("; ")}
                  </div>
                )}
              </article>
            ))}
          </div>
          {res.pm && (
            <article className="border border-ink-950 p-4">
              <div className={MICRO}>
                The Prime Minister arbitrates
                {!res.pm.approved && (
                  <span className="ml-1 text-signal-caution">· no approved PM profile</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-950">{res.pm.arbitration}</p>
              <p className="mt-3 border-l-2 border-gold-500 pl-3 text-sm text-ink-950">
                {res.pm.decision}
              </p>
              {!!res.pm.conditions.length && (
                <ul className="mt-2 list-disc pl-5 text-xs text-ink-700">
                  {res.pm.conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </article>
          )}
          <p className="text-[10px] text-ink-400">Rehearsal · {res.model}</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ approval

export function ApprovalBar({ data, onChanged }: { data: WorkspaceData; onChanged: () => void }) {
  const move = useServerFn(transitionPortfolioSet);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { set } = data;
  const meta = STATUS_META[set.status];
  const act = async (action: "submit" | "approve" | "return" | "withdraw" | "reopen") => {
    setBusy(action);
    setErr(null);
    try {
      await move({ data: { setId: set.id, action, note: action === "return" ? note : undefined } });
      setNote("");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const ready = set.phase === "done";
  return (
    <div className="border border-line-200 p-4">
      <div className="flex items-center justify-between">
        <div className={MICRO}>Approval</div>
        <span className={cn("text-[11px]", meta.text)}>
          <span
            className={cn(
              "mr-1 inline-block h-1.5 w-1.5 rounded-full border bg-current",
              meta.border,
            )}
          />
          {meta.label}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-ink-500">
        {set.scope_key === "REGIONAL"
          ? "Regional profiles are approved by a global admin other than the submitter."
          : "Country overlays are approved by the country admin or Cabinet Secretary, other than the submitter."}{" "}
        {data.canSoleApprove
          ? "You are the sole approver, so you may approve your own submission."
          : ""}
      </p>
      {set.approved_at && (
        <p className="mt-1 text-[11px] text-ink-700">
          Approved {formatWhen(set.approved_at)}
          {set.approval_mode === "sole_admin" ? " by the sole approver" : ""}.
        </p>
      )}
      {set.status === "returned" && set.returned_note && (
        <p className="mt-2 border-l-2 border-signal-negative pl-2 text-xs text-ink-950">
          {set.returned_note}
        </p>
      )}
      {err && <p className="mt-2 text-xs text-signal-negative">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {(set.status === "draft" || set.status === "returned") && data.canWrite && (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={!ready || !!busy}
            onClick={() => act("submit")}
            title={ready ? "" : "Finish the run first"}
          >
            {busy === "submit" ? "Submitting…" : "Submit for approval"}
          </button>
        )}
        {set.status === "submitted" && data.canApprove && (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={!!busy}
            onClick={() => act("approve")}
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
        )}
        {set.status === "submitted" && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={!!busy}
            onClick={() => act("withdraw")}
          >
            Withdraw
          </button>
        )}
        {set.status === "approved" && data.canApprove && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={!!busy}
            onClick={() => act("reopen")}
          >
            Reopen
          </button>
        )}
      </div>
      {set.status === "submitted" && data.canApprove && (
        <div className="mt-3">
          <textarea
            className={cn(FIELD, "min-h-16 text-xs")}
            placeholder="What needs to change (to return it)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Return note"
          />
          <button
            type="button"
            className="btn-ghost mt-1 px-3 py-1.5 text-xs"
            disabled={!!busy || !note.trim()}
            onClick={() => act("return")}
          >
            Return with note
          </button>
        </div>
      )}
      {!!data.history.length && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-ink-500">History</summary>
          <ul className="mt-1 space-y-1 text-[11px] text-ink-700">
            {data.history.map((h) => (
              <li key={h.id}>
                {formatWhen(h.at)} — {h.action.replace("portfolio_profile.", "").replace("_", " ")}
                {h.actorLabel ? ` · ${h.actorLabel}` : ""}
                {h.note ? ` · “${h.note}”` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
