// Add or edit an investor in the directory. KYC decisions are separate and
// only compliance officers see the buttons; the database enforces it too.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { saveInvestor, setKyc, type InvestorView } from "@/lib/investments/investors.functions";
import {
  INVESTOR_KIND_LABEL,
  INVESTOR_KINDS,
  type InvestorKind,
  type KycStatus,
} from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import { parseAmount } from "./ProjectForm";
import { Dot, ErrorText, errMessage, Field, formatDate, inputCls, MicroLabel, Note } from "./ui";

export const KYC_LABEL: Record<KycStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  cleared: "Cleared",
  failed: "Failed",
};
export const KYC_TONE: Record<KycStatus, "positive" | "negative" | "caution" | "muted"> = {
  not_started: "muted",
  in_progress: "caution",
  cleared: "positive",
  failed: "negative",
};
const KYC_TEXT: Record<KycStatus, string> = {
  not_started: "text-ink-500",
  in_progress: "text-signal-caution",
  cleared: "text-signal-positive",
  failed: "text-signal-negative",
};

export function KycMark({ status }: { status: KycStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", KYC_TEXT[status])}>
      <Dot tone={KYC_TONE[status]} />
      {KYC_LABEL[status]}
    </span>
  );
}

type Draft = {
  name: string;
  kind: InvestorKind;
  hq_country: string;
  website: string;
  contact_name: string;
  contact_email: string;
  ticket_min: string;
  ticket_max: string;
  sectors: string;
  notes: string;
};

function initial(i: InvestorView | null): Draft {
  return {
    name: i?.name ?? "",
    kind: i?.kind ?? "dfi",
    hq_country: i?.hq_country ?? "",
    website: i?.website ?? "",
    contact_name: i?.contact_name ?? "",
    contact_email: i?.contact_email ?? "",
    ticket_min: i?.ticket_min_usd == null ? "" : String(i.ticket_min_usd),
    ticket_max: i?.ticket_max_usd == null ? "" : String(i.ticket_max_usd),
    sectors: (i?.sectors ?? []).join(", "),
    notes: i?.notes ?? "",
  };
}

export function InvestorEditor({
  open,
  onOpenChange,
  code,
  investor,
  canDecideKyc,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: string;
  investor: InvestorView | null;
  canDecideKyc: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(saveInvestor);
  const kyc = useServerFn(setKyc);
  const [d, setD] = useState<Draft>(() => initial(investor));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>(investor?.kyc_status ?? "not_started");

  useEffect(() => {
    if (open) {
      setD(initial(investor));
      setKycStatus(investor?.kyc_status ?? "not_started");
      setErr(null);
    }
    // Reset only when the sheet opens or switches investor, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investor?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function submit() {
    setErr(null);
    const min = d.ticket_min.trim() ? parseAmount(d.ticket_min) : null;
    const max = d.ticket_max.trim() ? parseAmount(d.ticket_max) : null;
    if ((min != null && !Number.isFinite(min)) || (max != null && !Number.isFinite(max))) {
      return setErr("Ticket sizes must be numbers in US dollars, e.g. 5000000 or 5m.");
    }
    setBusy(true);
    try {
      await save({
        data: {
          code,
          id: investor?.id,
          name: d.name,
          kind: d.kind,
          hq_country: d.hq_country,
          website: d.website,
          contact_name: d.contact_name,
          contact_email: d.contact_email,
          ticket_min_usd: min,
          ticket_max_usd: max,
          sectors: d.sectors
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notes: d.notes,
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

  async function decide(status: KycStatus) {
    if (!investor) return;
    if (
      status === "cleared" &&
      !window.confirm(
        `Record ${investor.name}'s KYC as cleared? This lets their interest move into due diligence.`,
      )
    )
      return;
    setErr(null);
    setBusy(true);
    try {
      const r = await kyc({ data: { code, id: investor.id, status } });
      setKycStatus(r.kyc_status);
      await onSaved();
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-line-200 bg-paper-0 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-normal text-ink-950">
            {investor ? investor.name : "Add an investor"}
          </SheetTitle>
          <SheetDescription className="text-sm text-ink-600">
            {investor
              ? `Added ${formatDate(investor.created_at)}`
              : "An institution or company that may invest in this country's projects."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <input
                className={inputCls}
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Kind">
              <select
                className={inputCls}
                value={d.kind}
                onChange={(e) => set("kind", e.target.value as InvestorKind)}
              >
                {INVESTOR_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INVESTOR_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Headquarters">
              <input
                className={inputCls}
                value={d.hq_country}
                onChange={(e) => set("hq_country", e.target.value)}
              />
            </Field>
            <Field label="Ticket from (US$)">
              <input
                className={inputCls}
                inputMode="decimal"
                value={d.ticket_min}
                onChange={(e) => set("ticket_min", e.target.value)}
              />
            </Field>
            <Field label="Ticket up to (US$)">
              <input
                className={inputCls}
                inputMode="decimal"
                value={d.ticket_max}
                onChange={(e) => set("ticket_max", e.target.value)}
              />
            </Field>
            <Field label="Sectors" className="sm:col-span-2" hint="Separate with commas.">
              <input
                className={inputCls}
                value={d.sectors}
                onChange={(e) => set("sectors", e.target.value)}
              />
            </Field>
            <Field label="Contact name">
              <input
                className={inputCls}
                value={d.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
              />
            </Field>
            <Field label="Contact email">
              <input
                className={inputCls}
                type="email"
                value={d.contact_email}
                onChange={(e) => set("contact_email", e.target.value)}
              />
            </Field>
            <Field label="Website" className="sm:col-span-2">
              <input
                className={inputCls}
                value={d.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                className={inputCls}
                rows={3}
                value={d.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>

          <ErrorText>{err}</ErrorText>
          <div className="flex justify-end gap-2">
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
              {busy ? "Saving…" : investor ? "Save" : "Add investor"}
            </button>
          </div>

          {investor && (
            <section className="border-t border-line-200 pt-4">
              <MicroLabel>Know your customer (KYC)</MicroLabel>
              <div className="mt-1">
                <KycMark status={kycStatus} />
              </div>
              <p className="mt-1 text-xs text-ink-600">
                An interest cannot move into due diligence or beyond until the investor's KYC is
                cleared.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {kycStatus === "not_started" && (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => decide("in_progress")}
                  >
                    Mark in progress
                  </button>
                )}
                {canDecideKyc && kycStatus !== "cleared" && (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => decide("cleared")}
                  >
                    Clear KYC
                  </button>
                )}
                {canDecideKyc && kycStatus !== "failed" && (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => decide("failed")}
                  >
                    <span className="text-signal-negative">Record as failed</span>
                  </button>
                )}
                {canDecideKyc && kycStatus !== "in_progress" && kycStatus !== "not_started" && (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => decide("in_progress")}
                  >
                    Reopen as in progress
                  </button>
                )}
              </div>
              {!canDecideKyc && (
                <Note className="mt-3" tone="muted">
                  Only a compliance officer (country admin or cabinet secretary) can clear or fail
                  KYC.
                </Note>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
