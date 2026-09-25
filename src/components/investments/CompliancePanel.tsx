// The restricted compliance record. Compliance officers see and edit the
// beneficial owners and AML due diligence; everyone else sees only whether the
// two checks pass.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  AML_STATUS_LABEL,
  AML_STATUSES,
  complianceWarnings,
  getCompliance,
  saveCompliance,
  type AmlStatus,
} from "@/lib/investments/compliance.functions";
import type { BeneficialOwner } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import {
  Dot,
  ErrorText,
  errMessage,
  Field,
  formatDate,
  inputCls,
  MicroLabel,
  Note,
  SectionTitle,
} from "./ui";

type OwnerDraft = {
  name: string;
  nationality: string;
  ownership_pct: string;
  is_pep: boolean;
  evidence: string;
  legacy?: boolean;
};

function toOwnerDraft(o: BeneficialOwner): OwnerDraft {
  return {
    name: o.name ?? "",
    nationality: o.nationality ?? "",
    ownership_pct: o.ownership_pct == null ? "" : String(o.ownership_pct),
    is_pep: !!o.is_pep,
    evidence: o.evidence ?? "",
    legacy: o.legacy,
  };
}

function toOwner(d: OwnerDraft): BeneficialOwner {
  const pct = d.ownership_pct.trim() === "" ? null : Number(d.ownership_pct);
  return {
    name: d.name.trim(),
    nationality: d.nationality.trim() || null,
    ownership_pct: pct != null && Number.isFinite(pct) ? pct : null,
    is_pep: d.is_pep,
    evidence: d.evidence.trim() || null,
    ...(d.legacy ? { legacy: true } : {}),
  };
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Dot tone={ok ? "positive" : "negative"} />
      <span className="text-ink-950">{label}</span>
      <span className={cn("text-xs", ok ? "text-signal-positive" : "text-signal-negative")}>
        {ok ? "Yes" : "Not yet"}
      </span>
    </div>
  );
}

export function CompliancePanel({
  code,
  projectId,
  projectApproved,
  onSaved,
}: {
  code: string;
  projectId: string;
  projectApproved: boolean;
  onSaved?: () => void;
}) {
  const fetchC = useServerFn(getCompliance);
  const save = useServerFn(saveCompliance);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["investment-compliance", code, projectId],
    queryFn: () => fetchC({ data: { code, projectId } }),
  });

  const [owners, setOwners] = useState<OwnerDraft[]>([]);
  const [aml, setAml] = useState<AmlStatus>("not_started");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data && !q.data.restricted) {
      const c = q.data.compliance;
      setOwners(c.beneficial_owners.map(toOwnerDraft));
      setAml(c.aml_status);
      setRef(c.aml_reference ?? "");
      setNotes(c.notes ?? "");
    }
  }, [q.data]);

  const liveWarnings = useMemo(() => complianceWarnings(owners.map(toOwner)), [owners]);
  const total = owners.reduce((s, o) => s + (Number(o.ownership_pct) || 0), 0);

  if (q.isLoading) return <p className="text-sm text-ink-500">Loading…</p>;
  if (q.error) return <ErrorText>{errMessage(q.error)}</ErrorText>;
  if (!q.data) return null;

  if (q.data.restricted) {
    return (
      <div className="max-w-xl space-y-4">
        <Note tone="muted" title="Restricted — visible to compliance officers">
          Beneficial owners and anti-money-laundering (AML) due diligence are kept in a separate
          record that only country admins and cabinet secretaries can open. You can see whether each
          check passes.
        </Note>
        <div className="space-y-2">
          <Flag ok={q.data.bo_disclosed} label="Beneficial owners disclosed" />
          <Flag ok={q.data.aml_cleared} label="AML due diligence cleared" />
        </div>
      </div>
    );
  }

  const data = q.data;
  const originallyCleared = data.compliance.aml_status === "cleared";
  const creatorBlocked = data.viewerIsCreator && aml === "cleared" && !originallyCleared;

  const setOwner = (i: number, patch: Partial<OwnerDraft>) =>
    setOwners((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  async function submit() {
    setErr(null);
    setSaved(null);
    for (const o of owners) {
      if (o.name.trim().length < 3)
        return setErr("Each owner needs a full name (at least three characters).");
      const p = o.ownership_pct.trim();
      if (p && (!Number.isFinite(Number(p)) || Number(p) < 0 || Number(p) > 100))
        return setErr("Ownership must be between 0 and 100%.");
    }
    if (total > 100.0001) return setErr(`Ownership adds up to ${total}%, which is more than 100%.`);
    if (aml === "cleared" && !ref.trim())
      return setErr("Record the due-diligence reference when clearing AML.");
    setBusy(true);
    try {
      const r = await save({
        data: {
          code,
          projectId,
          owners: owners.map(toOwner),
          aml_status: aml,
          aml_reference: ref.trim() || null,
          notes: notes.trim() || null,
        },
      });
      setSaved(r.warnings);
      await qc.invalidateQueries({ queryKey: ["investment-compliance", code, projectId] });
      onSaved?.();
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <Note tone="caution" title="Restricted record">
        Only compliance officers can see this tab. Other team members see only whether owners are
        disclosed and AML is cleared.
      </Note>
      {projectApproved && (
        <Note tone="caution" title="This project is approved">
          If this save changes whether owners are disclosed or AML is cleared, the project goes back
          to draft and its share links pause until it is approved again.
        </Note>
      )}

      <section>
        <SectionTitle hint="Every natural person who ultimately owns or controls the sponsor or project company (FATF Recommendation 24).">
          Beneficial owners
        </SectionTitle>
        {owners.length === 0 && <p className="mb-3 text-sm text-ink-500">No owners listed.</p>}
        <div className="space-y-3">
          {owners.map((o, i) => (
            <div
              key={i}
              className={cn(
                "border border-line-200 border-l-2 p-3",
                o.legacy ? "border-l-signal-caution" : "border-l-line-200",
              )}
            >
              {o.legacy && (
                <p className="mb-2 text-xs text-signal-caution">
                  Migrated from the old free-text field. Split into named owners.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_6rem]">
                <Field label="Full name">
                  <input
                    className={inputCls}
                    value={o.name}
                    onChange={(e) => setOwner(i, { name: e.target.value })}
                  />
                </Field>
                <Field label="Nationality">
                  <input
                    className={inputCls}
                    value={o.nationality}
                    onChange={(e) => setOwner(i, { nationality: e.target.value })}
                  />
                </Field>
                <Field label="Ownership %">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={o.ownership_pct}
                    onChange={(e) => setOwner(i, { ownership_pct: e.target.value })}
                  />
                </Field>
                <Field
                  label="Evidence"
                  className="sm:col-span-2"
                  hint="e.g. company register extract, dated."
                >
                  <input
                    className={inputCls}
                    value={o.evidence}
                    onChange={(e) => setOwner(i, { evidence: e.target.value })}
                  />
                </Field>
                <div className="flex items-end justify-between gap-2 pb-1">
                  <label className="flex items-center gap-2 text-xs text-ink-800">
                    <input
                      type="checkbox"
                      checked={o.is_pep}
                      onChange={(e) => setOwner(i, { is_pep: e.target.checked })}
                    />
                    Politically exposed
                  </label>
                </div>
              </div>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => setOwners((p) => p.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() =>
              setOwners((p) => [
                ...p,
                { name: "", nationality: "", ownership_pct: "", is_pep: false, evidence: "" },
              ])
            }
          >
            Add owner
          </button>
          <span
            className={cn(
              "text-xs tabular-nums",
              total > 100
                ? "text-signal-negative"
                : total < 100 && owners.length
                  ? "text-signal-caution"
                  : "text-ink-500",
            )}
          >
            Listed ownership: {Math.round(total * 100) / 100}%
          </span>
        </div>
        {liveWarnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {liveWarnings.map((w) => (
              <li key={w} className="flex items-start gap-2 text-xs text-signal-caution">
                <Dot tone="caution" className="mt-1.5" />
                {w}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle hint="Anti-money-laundering due diligence on the sponsor and owners (FATF Recommendation 10).">
          AML due diligence
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select
              className={inputCls}
              value={aml}
              onChange={(e) => setAml(e.target.value as AmlStatus)}
            >
              {AML_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {AML_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Due-diligence reference"
            hint={aml === "cleared" ? "Required to clear." : "The file or case number."}
          >
            <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              className={inputCls}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        {data.compliance.aml_cleared_at && (
          <p className="mt-2 text-xs text-ink-500">
            Cleared on {formatDate(data.compliance.aml_cleared_at, true)}.
          </p>
        )}
        {creatorBlocked && (
          <Note tone="negative" className="mt-3" title="A second person must clear AML">
            You entered this project, so another compliance officer has to clear its AML due
            diligence.
          </Note>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line-200 pt-4">
        <button
          type="button"
          className="btn-primary px-4 py-2 text-xs"
          disabled={busy || creatorBlocked}
          onClick={submit}
        >
          {busy ? "Saving…" : "Save compliance record"}
        </button>
        <ErrorText>{err}</ErrorText>
        {saved && !err && (
          <span className="text-xs text-signal-positive">
            Saved.
            {saved.length
              ? ` ${saved.length} note${saved.length === 1 ? "" : "s"} above still apply.`
              : ""}
          </span>
        )}
      </div>
      <div>
        <MicroLabel>Last updated</MicroLabel>
        <p className="text-xs text-ink-700">
          {data.exists ? formatDate(data.compliance.updated_at, true) : "Not yet saved"}
        </p>
      </div>
    </div>
  );
}
