import { useQuery } from "@tanstack/react-query";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { latestCronCoverage } from "@/lib/press-monitor.functions";

/**
 * Small badge showing the last CRON sweep's country coverage.
 * Green when every country in the universe promoted at least one item this
 * window; amber otherwise, with a hover listing the missing country codes.
 */
export function CoverageBadge() {
  const { data } = useQuery({
    queryKey: ["narrative", "latest-cron-coverage"],
    queryFn: () => latestCronCoverage(),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  if (!data || data.universeCount === 0) return null;
  const complete = data.missing.length === 0;
  const startedAt = data.startedAt ? new Date(data.startedAt) : null;
  const timeLabel = startedAt
    ? startedAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
            complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
          aria-label="Last cron sweep coverage"
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`} />
          Coverage {data.coveredCount}/{data.universeCount}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 border border-line-200 p-3 text-xs">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Last cron sweep{data.window ? ` · ${data.window}` : ""}
        </p>
        <p className="mt-1 text-ink-800">{timeLabel}</p>
        {complete ? (
          <p className="mt-2 text-emerald-700">
            Every country in the sweep universe promoted at least one signal in this window.
          </p>
        ) : (
          <>
            <p className="mt-2 text-amber-900">
              {data.missing.length} country{data.missing.length === 1 ? "" : "s"} produced no items this window:
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-800 break-words">
              {data.missing.join(", ")}
            </p>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
