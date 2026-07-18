import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function LineageChevron({
  hasSignal, hasDossier, hasStrategy, hasComms, hasPublished,
}: {
  hasSignal: boolean; hasDossier: boolean; hasStrategy: boolean; hasComms: boolean; hasPublished: boolean;
}) {
  const nodes = [
    { label: "Signal", done: hasSignal },
    { label: "Dossier", done: hasDossier },
    { label: "Strategy", done: hasStrategy },
    { label: "Draft", done: hasComms },
    { label: "Published", done: hasPublished },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 border border-line-200 bg-paper-100/40 px-3 py-2">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]",
              n.done ? "border-emerald-600/50 bg-emerald-50 text-emerald-800" : "border-line-200 text-ink-500",
            )}
          >
            {n.done && <Check size={9} />} {n.label}
          </span>
          {i < nodes.length - 1 && <ChevronRight size={11} className="text-ink-500" />}
        </div>
      ))}
    </div>
  );
}
