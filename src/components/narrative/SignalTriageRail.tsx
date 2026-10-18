import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignalRow } from "./SignalRow";
import { PriorityChip } from "./PriorityPill";
import { SignalFilterBar, filtersFromSearch, hasFilters, useSignalSearch } from "./SignalFilterBar";
import {
  PRIORITY_ORDER,
  PRIORITY_META,
  countsByPriority,
  filterSignals,
  priorityFor,
  isPastWindow,
  sortSignals,
  type PriorityLevel,
  type SortKey,
} from "@/lib/narrative-priority";
import {
  getSignalRetention,
  listSignalsAtPriority,
  searchSignals,
  type PriorityCounts,
  type SignalRow as Signal,
} from "@/lib/narrative-chamber.functions";

type MarkFilter = "all" | "pinned" | "flagged" | "kept";

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
  total,
  priorityCounts,
}: {
  signals: Signal[];
  code: string;
  activeId?: string;
  /** True number of active signals (the list itself holds only the newest 200). */
  total?: number;
  /** Per-level counts across ALL active signals. Falls back to the loaded sample. */
  priorityCounts?: PriorityCounts;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");
  const [activeLevels, setActiveLevels] = useState<Set<PriorityLevel>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<PriorityLevel>>(new Set([4, 5]));

  const [markFilter, setMarkFilter] = useState<MarkFilter>("all");
  const fetchRetention = useServerFn(getSignalRetention);
  const retention = useQuery({
    queryKey: ["narrative-retention", code],
    queryFn: () => fetchRetention({ data: { countryCode: code } }),
    staleTime: 30_000,
  });
  const kept = retention.data?.kept ?? [];

  const { search } = useSignalSearch();
  const advFilters = useMemo(() => filtersFromSearch(search), [search]);
  const advOn = hasFilters(advFilters);
  const fetchSearch = useServerFn(searchSignals);
  const advQuery = useQuery({
    queryKey: ["narrative-signal-search", code, advFilters],
    queryFn: () => fetchSearch({ data: { countryCode: code, filters: advFilters } }),
    enabled: advOn,
    staleTime: 30_000,
  });
  const countryOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const sg of signals) for (const c of sg.countries ?? []) if (c !== code) m.set(c, (m.get(c) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => ({ code: c, name: c }));
  }, [signals, code]);

  const levelList = useMemo(() => [...activeLevels].sort(), [activeLevels]);
  const fetchAtPriority = useServerFn(listSignalsAtPriority);
  // Urgent levels (P1, P2) are always loaded in full so their groups match the tiles.
  const urgentQuery = useQuery({
    queryKey: ["narrative-signals-at-priority", code, [1, 2]],
    queryFn: () => fetchAtPriority({ data: { countryCode: code, levels: [1, 2] } }),
    staleTime: 30_000,
  });
  const mergedDefault = useMemo(() => {
    const seen = new Set(signals.map((s) => s.id));
    const extra = [...(urgentQuery.data ?? []), ...kept].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return [...signals, ...extra];
  }, [signals, urgentQuery.data, kept]);
  const levelQuery = useQuery({
    queryKey: ["narrative-signals-at-priority", code, levelList],
    queryFn: () => fetchAtPriority({ data: { countryCode: code, levels: levelList } }),
    enabled: levelList.length > 0,
    staleTime: 30_000,
  });

  // With a priority chosen, the list comes from the server across ALL signals;
  // otherwise it is the newest-200 sample.
  const markSource: Signal[] | null =
    markFilter === "all"
      ? null
      : kept.filter((s) =>
          markFilter === "pinned"
            ? !!s.pinned_at
            : markFilter === "flagged"
              ? !!s.flagged_at
              : isPastWindow(s.created_at),
        );
  const source: Signal[] = advOn
    ? (advQuery.data?.signals ?? [])
    : markSource
    ? markSource
    : levelList.length > 0
      ? (levelQuery.data ?? signals.filter((s) => activeLevels.has(priorityFor(s).level)))
      : mergedDefault;

  const filtered = useMemo(() => {
    const q = filterSignals(source, query);
    const byLevel = activeLevels.size ? q.filter((s) => activeLevels.has(priorityFor(s).level)) : q;
    return sortSignals(byLevel, sort);
  }, [source, query, sort, activeLevels]);

  const expiringSoon = useMemo(
    () =>
      signals.filter((s) => {
        const age = (Date.now() - new Date(s.created_at).getTime()) / 86_400_000;
        return !s.pinned_at && !s.flagged_at && age >= 27 && age <= 30;
      }).length,
    [signals],
  );
  const markCounts = {
    pinned: kept.filter((s) => s.pinned_at).length,
    flagged: kept.filter((s) => s.flagged_at).length,
    kept: kept.filter((s) => isPastWindow(s.created_at)).length,
  };

  const counts = useMemo(
    () => priorityCounts ?? countsByPriority(signals),
    [priorityCounts, signals],
  );
  const fullTotal = total ?? signals.length;
  const levelTotal = levelList.reduce((n, l) => n + (counts[l] ?? 0), 0);

  const toggleLevel = (lvl: PriorityLevel) => {
    const turningOn = !activeLevels.has(lvl);
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
    if (turningOn) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(lvl);
        return next;
      });
    }
  };
  const toggleCollapse = (lvl: PriorityLevel) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
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
        <Search
          size={12}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-500"
        />
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

      <div className="grid grid-cols-4 border border-line-200" role="tablist" aria-label="Signal view">
        {(
          [
            ["all", "Live", null],
            ["pinned", "Pinned", markCounts.pinned],
            ["flagged", "Flagged", markCounts.flagged],
            ["kept", "Kept 30d+", markCounts.kept],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={markFilter === key}
            onClick={() => setMarkFilter(key)}
            className={cn(
              "px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.12em]",
              markFilter === key ? "bg-ink-950 text-paper-0" : "text-ink-500 hover:text-ink-950",
            )}
          >
            {label}
            {n !== null ? ` · ${n}` : ""}
          </button>
        ))}
      </div>
      <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-ink-500">
        Last 30 days only · pin or flag to keep longer
        {expiringSoon > 0 && (
          <span className="text-amber-700"> · {expiringSoon} expiring in 3 days</span>
        )}
        {retention.data?.lastCleanupAt && (
          <>
            {" "}
            · Last cleanup {new Date(retention.data.lastCleanupAt).toLocaleDateString()},{" "}
            {retention.data.lastRemoved.toLocaleString()} removed
          </>
        )}
      </p>

      <SignalFilterBar countryOptions={countryOptions} />
      {advOn && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700">
          {advQuery.isFetching && !advQuery.data
            ? "Filtering every signal…"
            : `${(advQuery.data?.total ?? 0).toLocaleString()} signals match${(advQuery.data?.total ?? 0) > 200 ? " · newest 200 shown" : ""}`}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Sort</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="flex-1 border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-950 focus:border-ink-950 focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
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

      <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink-500">
        {levelList.length > 0
          ? levelQuery.isFetching && !levelQuery.data
            ? "Loading every signal at this priority…"
            : `Showing ${Math.min(levelTotal, 200).toLocaleString()} of ${levelTotal.toLocaleString()} at this priority${levelTotal > 200 ? " (newest 200)" : ""}`
          : fullTotal > signals.length
            ? "All urgent signals shown. Other levels show the newest; open a level to see all."
            : `${fullTotal.toLocaleString()} active signals`}
      </p>

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
                    "sticky top-0 z-10 flex w-full items-center justify-between border-l-4 bg-paper-0/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700 backdrop-blur",
                    meta.borderClass,
                  )}
                >
                  <span className="flex items-center gap-1">
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    {meta.label}
                  </span>
                  <span className="text-ink-500 tabular-nums">
                    {!query && rows.length < counts[lvl]
                      ? `${rows.length.toLocaleString()} of ${counts[lvl].toLocaleString()}`
                      : rows.length.toLocaleString()}
                  </span>
                </button>
                {!isCollapsed && (
                  <ul className="mt-1 space-y-1">
                    {rows.map((s) => (
                      <SignalRow key={s.id} signal={s} code={code} active={activeId === s.id} />
                    ))}
                  </ul>
                )}
                {!isCollapsed && !query && !activeLevels.has(lvl) && rows.length < counts[lvl] && (
                  <button
                    onClick={() => toggleLevel(lvl)}
                    className="mt-1 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 underline hover:text-ink-950"
                  >
                    Show all {counts[lvl].toLocaleString()}
                  </button>
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
        {filtered.length.toLocaleString()} shown
      </p>
    </div>
  );
}
