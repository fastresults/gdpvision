import { queryOptions, useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, Calendar, CheckCircle2 } from "lucide-react";

import { listCommsWorkflowCounts } from "@/lib/narrative.functions";
import { cn } from "@/lib/utils";

export type SmartView = "needs_you" | "in_review" | "scheduled" | "recently_released" | null;

export function TriageCards({
  code,
  active,
  onChange,
}: {
  code: string;
  active: SmartView;
  onChange: (v: SmartView) => void;
}) {
  const q = useQuery(
    queryOptions({
      queryKey: ["comms-workflow-counts", code],
      queryFn: () => listCommsWorkflowCounts({ data: { scopeKey: code } }),
      staleTime: 30_000,
    }),
  );
  const d = q.data;

  const cards: Array<{
    key: NonNullable<SmartView>;
    label: string;
    value: number;
    sub: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: string;
  }> = [
    {
      key: "needs_you",
      label: "Needs you",
      value: d?.needsYou ?? 0,
      sub: (d?.needsYou ?? 0) > 0 ? "Awaiting your action" : "You're all clear",
      icon: AlertCircle,
      accent: "text-rose-700",
    },
    {
      key: "in_review",
      label: "In review",
      value: d?.inReview ?? 0,
      sub: (d?.staleReview ?? 0) > 0 ? `${d?.staleReview} stale > 3 days` : "On track",
      icon: Clock,
      accent: "text-amber-700",
    },
    {
      key: "scheduled",
      label: "Scheduled",
      value: d?.scheduled ?? 0,
      sub: (d?.scheduled ?? 0) > 0 ? "Queued to publish" : "Nothing scheduled",
      icon: Calendar,
      accent: "text-sky-700",
    },
    {
      key: "recently_released",
      label: "Released",
      value: d?.released ?? 0,
      sub: "Last 7 days",
      icon: CheckCircle2,
      accent: "text-emerald-700",
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(isActive ? null : c.key)}
            className={cn(
              "border bg-paper-0 p-3 text-left transition hover:border-ink-950",
              isActive ? "border-ink-950 ring-1 ring-ink-950" : "border-line-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                {c.label}
              </span>
              <c.icon size={13} className={c.accent} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-serif text-2xl text-ink-950 tabular-nums">{c.value}</span>
            </div>
            <p className={cn("mt-0.5 text-[11px]", c.value > 0 ? "text-ink-700" : "text-ink-500")}>
              {c.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
}
