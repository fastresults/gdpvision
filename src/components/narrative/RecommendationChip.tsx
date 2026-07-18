import { cn } from "@/lib/utils";
import type { SignalRecommendation } from "@/lib/narrative-chamber.functions";

const STYLES: Record<SignalRecommendation, string> = {
  lead: "border-ink-950 bg-ink-950 text-paper-0",
  amplify: "border-emerald-600/50 bg-emerald-50 text-emerald-800",
  counter: "border-rose-500/60 bg-rose-50 text-rose-700",
  monitor: "border-amber-500/40 bg-amber-50 text-amber-800",
  ignore: "border-line-200 bg-paper-100 text-ink-500",
};

const LABELS: Record<SignalRecommendation, string> = {
  lead: "Lead",
  amplify: "Amplify",
  counter: "Counter",
  monitor: "Monitor",
  ignore: "Ignore",
};

export function RecommendationChip({ value }: { value: SignalRecommendation | null | undefined }) {
  if (!value) return <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">—</span>;
  return (
    <span className={cn("inline-block border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]", STYLES[value])}>
      {LABELS[value]}
    </span>
  );
}
