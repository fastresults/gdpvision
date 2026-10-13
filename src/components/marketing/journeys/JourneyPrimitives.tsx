import { Check, FileText, LockKeyhole, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BeatLabel({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
      <span className="mr-2 text-gold-500">0{index + 1}</span>{children}
    </div>
  );
}

export function DecisionDocket({ title, active = false }: { title: string; active?: boolean }) {
  return (
    <div className={cn("cjj-docket relative border bg-paper-0 p-3", active ? "border-gold-500" : "border-line-200")}>
      <FileText className="h-4 w-4 text-gold-500" aria-hidden="true" />
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Decision for review</div>
      <div className="mt-1 text-[13px] font-semibold leading-snug text-ink-950">{title}</div>
      <span className="absolute right-2 top-2 h-2 w-2 border-r border-t border-gold-500" />
    </div>
  );
}

export function EvidenceDocument({ label, privateRecord = false, active = false }: { label: string; privateRecord?: boolean; active?: boolean }) {
  return (
    <div className={cn("cjj-document border bg-paper-0 px-2 py-2", active ? "border-gold-500" : "border-line-200")}>
      <div className="flex items-center gap-1.5">
        {privateRecord ? <LockKeyhole className="h-3 w-3 text-gold-500" /> : <FileText className="h-3 w-3 text-ink-500" />}
        <span className="text-[12px] font-medium leading-tight text-ink-950">{label}</span>
      </div>
    </div>
  );
}

export function ApprovalGate({ open, label = "Approval check" }: { open: boolean; label?: string }) {
  return (
    <div className={cn("cjj-gate flex items-center justify-center gap-2 border px-3 py-2", open ? "border-gold-500 bg-ink-950 text-paper-0" : "border-line-200 bg-paper-0 text-ink-500")}>
      {open ? <Check className="h-3.5 w-3.5 text-gold-500" /> : <Stamp className="h-3.5 w-3.5" />}
      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
    </div>
  );
}

export function GoldRoute({ active = false, vertical = false }: { active?: boolean; vertical?: boolean }) {
  return <span aria-hidden="true" className={cn("cjj-route block bg-line-200", vertical ? "h-8 w-px" : "h-px w-full", active && "cjj-route-active bg-gold-500")} />;
}