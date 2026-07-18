import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignalRow } from "./SignalRow";
import { PriorityChip } from "./PriorityPill";
import {
  PRIORITY_ORDER,
  PRIORITY_META,
  countsByPriority,
  filterSignals,
  priorityFor,
  sortSignals,
  type PriorityLevel,
  type SortKey,
} from "@/lib/narrative-priority";
import type { SignalRow as Signal } from "@/lib/narrative-chamber.functions";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "newest", label: "Newest" },
  { value: "severity", label: "Severity" },
  { value: "reach", label: "Reach" },
  { value: "sentiment", label: "Sentiment" },
];

export function SignalTriageRail({
  signals,
  code,
  activeId,
}: {
  signals: Signal[];
  code: string;
  activeId?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");
  const [activeLevels, setActiveLevels] = useState<Set<PriorityLevel>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<PriorityLevel>>(new Set([4, 5]));

  const filtered = useMemo(() => {
    const q = filterSignals(signals, query);
    const byLevel = activeLevels.size
      ? q.filter((s) => activeLevels.has(priorityFor(s).level))
      : q;
    return sortSignals(byLevel, sort);
  }, [signals, query, sort, activeLevels]);

  const counts = useMemo(() => countsByPriority(signals), [signals]);

  const toggleLevel = (lvl: PriorityLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl); else next.add(lvl);
      return next;
    });
  };
  const toggleCollapse = (lvl: PriorityLevel) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl); else next.add(lvl);
      return next;
    });
  };

  // Group when sorting by priority; otherwise flat list.
  const grouped = sort === "priority";
  const byLevel = useMemo(() => {
    const m: Record<PriorityLevel, Signal[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const s of filtered) m[priorityFor(s).level].push(s);
    return m;
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search signals…"
          className="w-full border border-line-200 bg-paper-0 pl-7 pr-7 py-1.5 text-xs text-ink-950 placeholder:text-ink-500 focus:border-ink-950 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink-500 hover:text-ink-950"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Sort</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="flex-1 border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-950 focus:border-ink-950 focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRIORITY_ORDER.map((lvl) => (
          <PriorityChip
            key={lvl}
            level={lvl}
            count={counts[lvl]}
            active={activeLevels.has(lvl)}
            onClick={() => toggleLevel(lvl)}
          />
        ))}
        {activeLevels.size > 0 && (
          <button
            onClick={() => setActiveLevels(new Set())}
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 underline hover:text-ink-950"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="border border-dashed border-line-200 p-3 text-xs text-ink-500">
          No signals match.
        </p>
      )}

      {grouped ? (
        <div className="space-y-3">
          {PRIORITY_ORDER.map((lvl) => {
            const rows = byLevel[lvl];
            if (rows.length === 0) return null;
            const meta = PRIORITY_META[lvl];
            const isCollapsed = collapsed.has(lvl);
            return (
              <div key={lvl}>
                <button
                  onClick={() => toggleCollapse(lvl)}
                  className={cn(
                    "flex w-full items-center justify-between border-l-4 bg-paper-100/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700",
                    meta.borderClass,
                  )}
                >
                  <span className="flex items-center gap-1">
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    {meta.label}
                  </span>
                  <span className="text-ink-500">{rows.length}</span>
                </button>
                {!isCollapsed && (
                  <ul className="mt-1 space-y-1">
                    {rows.map((s) => (
                      <SignalRow key={s.id} signal={s} code={code} active={activeId === s.id} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-1">
          {filtered.slice(0, 60).map((s) => (
            <SignalRow key={s.id} signal={s} code={code} active={activeId === s.id} />
          ))}
        </ul>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
        {filtered.length} of {signals.length} shown
      </p>
    </div>
  );
}
