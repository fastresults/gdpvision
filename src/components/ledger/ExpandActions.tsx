// One-click follow-ups that expand an answer into an artifact.

import { ScrollText, ClipboardList, Megaphone, MicVocal, PenLine } from "lucide-react";
import type { LedgerArtifactKind } from "@/lib/ledger.functions";

interface Action {
  kind: LedgerArtifactKind;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const ACTIONS: Action[] = [
  { kind: "policy_memo", label: "Policy Memo", desc: "Context · Options · Recommendation", Icon: ScrollText },
  { kind: "exec_brief", label: "Executive Brief", desc: "TL;DR · Findings · Decision", Icon: ClipboardList },
  { kind: "press_release", label: "Press Release", desc: "Headline · Quotes · Boilerplate", Icon: Megaphone },
  { kind: "talking_points", label: "Cabinet Talking Points", desc: "Minister voice · Anticipated Q&A", Icon: MicVocal },
  { kind: "op_ed", label: "Op-Ed Draft", desc: "First-person · ~600 words", Icon: PenLine },
];

export function ExpandActions({
  onPick,
  activeKinds,
}: {
  onPick: (kind: LedgerArtifactKind) => void;
  activeKinds: Set<LedgerArtifactKind>;
}) {
  return (
    <div className="mt-4 border-t border-line-200 pt-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Expand this finding
      </p>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 sm:grid sm:grid-cols-2 sm:gap-2 sm:overflow-visible"
      >
        {ACTIONS.map(({ kind, label, desc, Icon }) => {
          const active = activeKinds.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onPick(kind)}
              aria-label={`Expand into ${label}`}
              className={`group flex min-w-[220px] snap-start items-start gap-2.5 border px-2.5 py-2 text-left transition-colors sm:min-w-0 ${
                active
                  ? "border-ink-950 bg-ink-950 text-paper-0"
                  : "border-line-200 bg-paper-0 text-ink-950 hover:border-ink-950"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border ${
                  active ? "border-paper-0/30 bg-paper-0/10" : "border-line-200 bg-paper-50 group-hover:border-ink-950"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium leading-tight">{label}</span>
                <span
                  className={`mt-0.5 block text-[10px] leading-tight ${
                    active ? "text-paper-0/70" : "text-ink-500"
                  }`}
                >
                  {desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
