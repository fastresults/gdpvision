// Create or update one investor interest. The stage selector shows each
// stage's gate before the person hits it; the database enforces the same gates
// and its message is shown if a save is refused.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { saveInterest, type InterestView } from "@/lib/investments/investors.functions";
import {
  INTEREST_STAGE_GATE,
  INTEREST_STAGE_LABEL,
  INTEREST_STAGES,
  type InterestStage,
  type KycStatus,
} from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import { parseAmount } from "./ProjectForm";
import { Dot, ErrorText, errMessage, Field, formatDate, inputCls, MicroLabel, Note } from "./ui";

type InvestorOption = { id: string; name: string; kyc_status: KycStatus };
type ProjectOption = { id: string; title: string };

const STAGE_ORDER: Record<InterestStage, number> = Object.fromEntries(
  INTEREST_STAGES.map((s, i) => [s, i]),
) as Record<InterestStage, number>;

/** Which gate conditions the draft does not yet meet for a stage. */
export function unmetGates(
  stage: InterestStage,
  d: { nda_signed_at: string; investor_id: string; lost_reason: string },
  investors: InvestorOption[],
): string[] {
  const out: string[] = [];
  if (stage === "closed_lost") {
    if (!d.lost_reason.trim()) out.push("Record why the opportunity was lost.");
    return out;
  }
  const pos = STAGE_ORDER[stage];
  if (pos >= STAGE_ORDER.nda_signed && !d.nda_signed_at) out.push("Record the NDA signature date.");
  if (pos >= STAGE_ORDER.due_diligence) {
    const inv = investors.find((i) => i.id === d.investor_id);
    if (!inv) out.push("Match this interest to an investor record.");
    else if (inv.kyc_status !== "cleared")
      out.push(
        `${inv.name}'s KYC is not cleared yet. A compliance officer clears it in the directory.`,
      );
  }
  return out;
}

type Draft = {
  project_id: string;
  investor_id: string;
  stage: InterestStage;
  amount: string;
  next_step: string;
  next_step_due: string;
  owner: "me" | "none" | "keep";
  nda_signed_at: string;
  lost_reason: string;
  contact_name: string;
  contact_email: string;
  organisation: string;
  message: string;
};

function initial(interest: InterestView | null, defaultProjectId?: string): Draft {
  return {
    project_id: interest?.project_id ?? defaultProjectId ?? "",
    investor_id: interest?.investor_id ?? "",
    stage: interest?.stage ?? "identified",
    amount: interest?.indicative_amount_usd == null ? "" : String(interest.indicative_amount_usd),
    next_step: interest?.next_step ?? "",
    next_step_due: interest?.next_step_due ?? "",
    owner: interest ? (interest.owner_id ? "keep" : "none") : "me",
    nda_signed_at: interest?.nda_signed_at ?? "",
    lost_reason: interest?.lost_reason ?? "",
    contact_name: interest?.contact_name ?? "",
    contact_email: interest?.contact_email ?? "",
    organisation: interest?.organisation ?? "",
    message: interest?.message ?? "",
  };
}

export function InterestEditor({
  open,
  onOpenChange,
  code,
  interest,
  defaultProjectId,
  projects,
  investors,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: string;
  /** null to create. */
  interest: InterestView | null;
  defaultProjectId?: string;
  projects: ProjectOption[];
  investors: InvestorOption[];
  userId: string;
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(saveInterest);
  const [d, setD] = useState<Draft>(() => initial(interest, defaultProjectId));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setD(initial(interest, defaultProjectId));
      setErr(null);
    }
    // Reset only when the sheet opens or switches interest, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, interest?.id, defaultProjectId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const inbound = interest?.source === "share_link";
  const unmet = unmetGates(d.stage, d, investors);
  const ownerIsOther = interest?.owner_id && interest.owner_id !== userId;

  async function submit() {
    setErr(null);
    const amount = d.amount.trim() === "" ? null : parseAmount(d.amount);
    if (amount != null && !Number.isFinite(amount))
      return setErr("The indicative amount must be a number in US dollars, e.g. 5000000 or 5m.");
    if (!interest && !d.project_id) return setErr("Choose the project.");
    if (!interest && !d.investor_id && !d.contact_name.trim() && !d.organisation.trim()) {
      return setErr("Choose an investor, or give a contact name or organisation.");
    }
    setBusy(true);
    try {
      await save({
        data: {
          code,
          id: interest?.id,
          project_id: interest ? undefined : d.project_id,
          investor_id: d.investor_id || null,
          stage: d.stage,
          indicative_amount_usd: amount,
          next_step: d.next_step,
          next_step_due: d.next_step_due || null,
          owner_id: d.owner === "me" ? userId : d.owner === "none" ? null : undefined,
          nda_signed_at: d.nda_signed_at || null,
          lost_reason: d.lost_reason,
          ...(interest
            ? {}
            : {
                contact_name: d.contact_name,
                contact_email: d.contact_email,
                organisation: d.organisation,
                message: d.message,
              }),
        },
      });
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const title = interest
    ? (interest.investorName ?? interest.organisation ?? interest.contact_name ?? "Interest")
    : "Add interest";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-line-200 bg-paper-0 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-normal text-ink-950">{title}</SheetTitle>
          <SheetDescription className="text-sm text-ink-600">
            {interest ? interest.projectTitle : "Record an investor's interest in a project."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {inbound && interest && (
            <Note
              tone={interest.investor_id ? "muted" : "caution"}
              title={interest.investor_id ? "Enquiry through a share link" : "Match to an investor"}
            >
              <div className="text-sm">
                {interest.contact_name}
                {interest.organisation ? ` · ${interest.organisation}` : ""}
                {interest.contact_email ? (
                  <>
                    {" · "}
                    <a
                      className="underline decoration-line-200 underline-offset-2"
                      href={`mailto:${interest.contact_email}`}
                    >
                      {interest.contact_email}
                    </a>
                  </>
                ) : null}
              </div>
              {interest.message && (
                <p className="mt-1 whitespace-pre-wrap text-xs text-ink-700">{interest.message}</p>
              )}
              <p className="mt-1 text-[11px] text-ink-500">
                Received {formatDate(interest.created_at, true)}
              </p>
            </Note>
          )}

          {!interest && (
            <Field label="Project">
              <select
                className={inputCls}
                value={d.project_id}
                onChange={(e) => set("project_id", e.target.value)}
                disabled={!!defaultProjectId}
              >
                <option value="">Choose…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label="Investor"
            hint={
              investors.length === 0
                ? "No investors in the directory yet. Add them on the Investors page."
                : undefined
            }
          >
            <select
              className={inputCls}
              value={d.investor_id}
              onChange={(e) => set("investor_id", e.target.value)}
            >
              <option value="">{inbound ? "Not matched yet" : "No investor record yet"}</option>
              {investors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.kyc_status === "cleared" ? " · KYC cleared" : ""}
                </option>
              ))}
            </select>
          </Field>

          {!interest && !d.investor_id && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact name">
                <input
                  className={inputCls}
                  value={d.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                />
              </Field>
              <Field label="Organisation">
                <input
                  className={inputCls}
                  value={d.organisation}
                  onChange={(e) => set("organisation", e.target.value)}
                />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <input
                  className={inputCls}
                  type="email"
                  value={d.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                />
              </Field>
            </div>
          )}

          <Field label="Stage">
            <select
              className={inputCls}
              value={d.stage}
              onChange={(e) => set("stage", e.target.value as InterestStage)}
            >
              {INTEREST_STAGES.map((s) => (
                <option key={s} value={s}>
                  {INTEREST_STAGE_LABEL[s]}
                  {INTEREST_STAGE_GATE[s] ? ` — ${INTEREST_STAGE_GATE[s]}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {INTEREST_STAGE_GATE[d.stage] && (
            <div
              className={cn(
                "border-l-2 pl-2 text-xs",
                unmet.length
                  ? "border-l-signal-caution text-signal-caution"
                  : "border-l-signal-positive text-signal-positive",
              )}
            >
              {unmet.length ? (
                <ul className="space-y-0.5">
                  {unmet.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              ) : (
                "The conditions for this stage are met."
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="NDA signed on">
              <input
                className={inputCls}
                type="date"
                value={d.nda_signed_at}
                onChange={(e) => set("nda_signed_at", e.target.value)}
              />
            </Field>
            <Field label="Indicative amount (US$)">
              <input
                className={inputCls}
                inputMode="decimal"
                value={d.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>
            <Field label="Next step" className="sm:col-span-2">
              <input
                className={inputCls}
                value={d.next_step}
                onChange={(e) => set("next_step", e.target.value)}
              />
            </Field>
            <Field label="Next step due">
              <input
                className={inputCls}
                type="date"
                value={d.next_step_due}
                onChange={(e) => set("next_step_due", e.target.value)}
              />
            </Field>
            <Field label="Owner">
              <select
                className={inputCls}
                value={d.owner}
                onChange={(e) => set("owner", e.target.value as Draft["owner"])}
              >
                {interest?.owner_id && (
                  <option value="keep">
                    {ownerIsOther ? (interest.ownerName ?? "Current owner") : "You"}
                  </option>
                )}
                {!(interest?.owner_id === userId) && <option value="me">Me</option>}
                <option value="none">Unassigned</option>
              </select>
            </Field>
          </div>

          {d.stage === "closed_lost" && (
            <Field label="Why was it lost?">
              <textarea
                className={inputCls}
                rows={2}
                value={d.lost_reason}
                onChange={(e) => set("lost_reason", e.target.value)}
              />
            </Field>
          )}

          {interest && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500">
              <span>
                <MicroLabel className="inline">Source</MicroLabel>{" "}
                {interest.source === "share_link" ? "Share link" : "Entered by the team"}
              </span>
              <span>
                <MicroLabel className="inline">Updated</MicroLabel>{" "}
                {formatDate(interest.updated_at, true)}
              </span>
              {interest.investorKyc && (
                <span className="inline-flex items-center gap-1">
                  <Dot
                    tone={
                      interest.investorKyc === "cleared"
                        ? "positive"
                        : interest.investorKyc === "failed"
                          ? "negative"
                          : "muted"
                    }
                  />
                  KYC {interest.investorKyc.replace("_", " ")}
                </span>
              )}
            </div>
          )}

          <ErrorText>{err}</ErrorText>
          <div className="flex justify-end gap-2 border-t border-line-200 pt-3">
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={busy}
              onClick={submit}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
