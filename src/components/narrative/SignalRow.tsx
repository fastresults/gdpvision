import { Link } from "@tanstack/react-router";
import { Globe2, MapPin, Building2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecommendationChip } from "./RecommendationChip";
import { PriorityPill } from "./PriorityPill";
import { priorityFor } from "@/lib/narrative-priority";
import type { SignalRow as Signal } from "@/lib/narrative-chamber.functions";

const SCOPE_ICON = { local: MapPin, regional: Building2, international: Globe2 } as const;
const SCOPE_LABEL = { local: "LOC", regional: "REG", international: "INT" } as const;

export function SignalRow({ signal, code, active }: { signal: Signal; code: string; active?: boolean }) {
  const scopeKey = (signal.scope as keyof typeof SCOPE_ICON) ?? "local";
  const Icon = SCOPE_ICON[scopeKey] ?? MapPin;
  const scopeLabel = SCOPE_LABEL[scopeKey] ?? "LOC";
  const sentimentTone =
    (signal.sentiment ?? 0) <= -1 ? "text-rose-600" : (signal.sentiment ?? 0) >= 1 ? "text-emerald-700" : "text-ink-500";
  const meta = priorityFor(signal);
  const md = (signal.metadata as { related_coverage?: unknown[] } | null) ?? {};
  const siblings = Array.isArray(md.related_coverage) ? md.related_coverage.length : 0;

  return (
    <li className="min-w-0">
      <Link
        to="/admin/countries/$code/narrative/signal/$id"
        params={{ code, id: signal.id }}
        className={cn(
          "block min-w-0 overflow-hidden border border-line-200 border-l-4 px-2.5 py-2 text-sm text-ink-700 transition hover:border-ink-950",
          meta.borderClass,
          active && "border-ink-950 bg-paper-100",
        )}
      >
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <PriorityPill signal={signal} />
            {siblings > 0 && (
              <span
                className="inline-flex items-center gap-0.5 border border-line-200 bg-paper-100 px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-700"
                title={`${siblings + 1} outlets covering this story`}
              >
                <Layers size={9} /> +{siblings}
              </span>
            )}
          </div>
          <RecommendationChip value={signal.recommendation} />
        </div>
        <p className="mt-1.5 line-clamp-3 min-w-0 break-words text-[13px] leading-snug text-ink-900">
          {signal.topic}
        </p>
        <div className="mt-1 flex items-center gap-1.5 overflow-hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
          <Icon size={10} className="shrink-0" />
          <span className="shrink-0">{scopeLabel}</span>
          {signal.sector_code && (
            <>
              <span className="shrink-0 text-ink-400">·</span>
              <span className="truncate">{signal.sector_code}</span>
            </>
          )}
          <span className="shrink-0 text-ink-400">·</span>
          <span className="shrink-0">S{signal.severity ?? "—"}</span>
          <span className="shrink-0">R{signal.reach ?? "—"}</span>
          <span className={cn("shrink-0", sentimentTone)}>
            {(signal.sentiment ?? 0) > 0 ? `+${signal.sentiment}` : signal.sentiment ?? "—"}
          </span>
        </div>
      </Link>
    </li>
  );
}
