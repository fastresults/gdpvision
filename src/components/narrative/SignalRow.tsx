import { Link } from "@tanstack/react-router";
import { Globe2, MapPin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecommendationChip } from "./RecommendationChip";
import type { SignalRow as Signal } from "@/lib/narrative-chamber.functions";

const SCOPE_ICON = { local: MapPin, regional: Building2, international: Globe2 } as const;

export function SignalRow({ signal, code, active }: { signal: Signal; code: string; active?: boolean }) {
  const Icon = SCOPE_ICON[(signal.scope as keyof typeof SCOPE_ICON) ?? "local"] ?? MapPin;
  const sentimentTone =
    (signal.sentiment ?? 0) <= -1 ? "text-rose-600" : (signal.sentiment ?? 0) >= 1 ? "text-emerald-700" : "text-ink-500";

  return (
    <li className="min-w-0">
      <Link
        to="/admin/countries/$code/narrative/signal/$id"
        params={{ code, id: signal.id }}
        className={cn(
          "block min-w-0 overflow-hidden border border-line-200 px-3 py-2 text-sm text-ink-700 transition hover:border-ink-950",
          active && "border-ink-950 bg-paper-100",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 min-w-0 break-words">{signal.topic}</span>
          <RecommendationChip value={signal.recommendation} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
          <span className="flex items-center gap-1"><Icon size={10} /> {signal.scope ?? "—"}</span>
          {signal.sector_code && <span className="truncate max-w-[8ch]">{signal.sector_code}</span>}
          <span>Sev {signal.severity ?? "—"}</span>
          <span>Reach {signal.reach ?? "—"}</span>
          <span className={sentimentTone}>
            {(signal.sentiment ?? 0) > 0 ? `+${signal.sentiment}` : signal.sentiment ?? "—"}
          </span>
        </div>
      </Link>
    </li>
  );
}

