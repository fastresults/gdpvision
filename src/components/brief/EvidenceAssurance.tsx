import { ArrowRight, CheckCircle2, CircleAlert, FileCheck2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  countEvidence,
  type EvidenceEntry,
  type EvidenceCounts,
  type EvidenceState,
} from "@/lib/calculator/evidence";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<EvidenceState, string> = {
  record: "From the national record",
  reference: "Reference assumption",
  adjusted: "Adjusted by you",
};

const STATE_CLASS: Record<EvidenceState, string> = {
  record: "text-signal-positive",
  reference: "text-signal-caution",
  adjusted: "text-ink-700",
};

export function EvidenceStatus({
  entry,
  onInspect,
  className,
}: {
  entry: EvidenceEntry;
  onInspect: (key: string) => void;
  className?: string;
}) {
  const detail =
    entry.state === "record"
      ? `Grade ${entry.grade}`
      : entry.state === "reference"
        ? entry.benchmark || "regional benchmark"
        : "not independently validated";

  return (
    <button
      type="button"
      onClick={() => onInspect(entry.key)}
      className={cn(
        "btn-ghost inline-flex h-auto min-h-0 items-center gap-2 border-transparent px-0 py-0 text-left font-mono text-[9.5px] uppercase tracking-[0.14em] hover:border-transparent hover:bg-transparent hover:underline hover:decoration-current hover:underline-offset-4 focus-visible:border-transparent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current",
        STATE_CLASS[entry.state],
        className,
      )}
      aria-label={`${entry.label}: ${STATE_LABEL[entry.state]}, ${detail}. Review evidence status`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      <span>{STATE_LABEL[entry.state]}</span>
      <span aria-hidden>·</span>
      <span>{detail}</span>
    </button>
  );
}

export function EvidenceAssuranceStrip({
  entries,
  onOpen,
}: {
  entries: EvidenceEntry[];
  onOpen: () => void;
}) {
  const counts = countEvidence(entries);
  return (
    <section
      className="border-y border-line-200 bg-paper-50 print:hidden"
      aria-label="Evidence status"
    >
      <div className="mx-auto grid max-w-[1280px] gap-5 px-5 py-5 sm:px-6 md:grid-cols-[1fr_auto] md:items-center md:px-10">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Public indicative model · evidence status
          </div>
          <p className="mt-2 max-w-4xl text-[14px] leading-relaxed text-ink-700">
            This open brief combines graded national records with clearly marked reference
            assumptions. Government engagement replaces assumptions with authorised data, named
            custodians and a dated, approved evidence baseline before recommendations are relied
            upon.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em]">
            <span className="text-signal-positive">{counts.record} record-backed</span>
            <span className="text-signal-caution">{counts.reference} reference-based</span>
            <span className="text-ink-700">{counts.adjusted} user-adjusted</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs"
        >
          How this becomes decision-grade <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

export function EvidencePathwayModal({
  entries,
  selectedKey,
  open,
  onOpenChange,
}: {
  entries: EvidenceEntry[];
  selectedKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = entries.find((entry) => entry.key === selectedKey) ?? null;
  const unresolved = entries.filter((entry) => entry.state !== "record");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-24px)] max-w-3xl gap-0 overflow-y-auto rounded-none border-line-200 bg-paper-0 p-0 sm:rounded-none">
        <DialogHeader className="space-y-0 border-b border-line-200 px-5 py-5 text-left sm:px-7">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Evidence assurance pathway
          </div>
          <DialogTitle className="mt-3 font-serif text-[26px] font-normal leading-tight text-ink-950 md:text-[32px]">
            From public estimate to decision-grade brief
          </DialogTitle>
          <DialogDescription className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink-700">
            The public instrument is designed to frame the decision openly. Formal engagement turns
            that starting point into a controlled government evidence product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 px-5 py-7 sm:px-7">
          {selected ? (
            <section className="border-l-2 border-gold-500 bg-paper-50 px-5 py-4">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-500">
                Current input under review
              </div>
              <h3 className="mt-2 font-serif text-[20px] text-ink-950">{selected.label}</h3>
              <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-2">
                <div>
                  <dt className="text-ink-500">Current basis</dt>
                  <dd className="mt-1 text-ink-950">
                    {STATE_LABEL[selected.state]} · {selected.source}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Current value</dt>
                  <dd className="mt-1 font-mono text-ink-950">{selected.display}</dd>
                </div>
              </dl>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-700">
                <strong className="font-medium text-ink-950">
                  Evidence required to replace or validate it:
                </strong>{" "}
                {selected.replacement}
              </p>
            </section>
          ) : null}

          <section>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Government assurance sequence
            </div>
            <ol className="mt-4 divide-y divide-line-100 border-y border-line-100">
              {[
                [
                  "01",
                  "Establish the baseline",
                  "Reconcile current national statistics, approved records and reporting periods.",
                ],
                [
                  "02",
                  "Replace assumptions",
                  "Ingest the administrative datasets identified against each reference value.",
                ],
                [
                  "03",
                  "Validate and assign accountability",
                  "Record the source, period, custodian and authorised reviewer for every input.",
                ],
                [
                  "04",
                  "Issue the controlled brief",
                  "Lock the evidence date, model version, approvals and audit trail for formal use.",
                ],
              ].map(([n, title, body]) => (
                <li key={n} className="grid gap-2 py-4 sm:grid-cols-[44px_190px_1fr] sm:gap-5">
                  <span className="font-mono text-[10px] text-ink-500">{n}</span>
                  <strong className="text-[14px] font-medium text-ink-950">{title}</strong>
                  <span className="text-[13.5px] leading-relaxed text-ink-700">{body}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Evidence still to be strengthened
              </div>
              <span className="font-mono text-[10px] text-ink-500">
                {unresolved.length} of {entries.length}
              </span>
            </div>
            {unresolved.length ? (
              <ul className="mt-4 divide-y divide-line-100 border-y border-line-100">
                {unresolved.map((entry) => (
                  <li
                    key={entry.key}
                    className="grid gap-2 py-3 sm:grid-cols-[1fr_1.35fr] sm:gap-6"
                  >
                    <div className="flex items-start gap-2 text-[13.5px] text-ink-950">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-caution" />
                      {entry.label}
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-ink-500">
                      {entry.replacement}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex items-center gap-3 border-y border-line-100 py-4 text-[13.5px] text-ink-700">
                <CheckCircle2 className="h-4 w-4 text-signal-positive" />
                Every input is currently supported by the national record.
              </div>
            )}
          </section>

          <div className="flex gap-3 border-t border-line-200 pt-5 text-[12.5px] leading-relaxed text-ink-500">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
            User adjustments remain scenarios until independently validated. They are never promoted
            to official facts by this public calculator.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
