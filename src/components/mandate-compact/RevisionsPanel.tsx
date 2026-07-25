// Chamber 08 · Slice E — Revisions timeline + diff viewer.
// Renders the append-only history of a compact (from compact_revisions) and
// lets the admin diff any two revisions to see exactly what changed.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, GitCommit, GitCompare, Clock } from "lucide-react";

import {
  listCompactRevisions,
  compareCompactRevisions,
  type CompactDiff,
  type RevisionRow,
} from "@/lib/mandate-compact/revisions.functions";
import { cn } from "@/lib/utils";

export function RevisionsPanel({ compactId }: { compactId: string }) {
  const listFn = useServerFn(listCompactRevisions);
  const compareFn = useServerFn(compareCompactRevisions);

  const { data: revisions, isLoading, isError, error } = useQuery({
    queryKey: ["compact-revisions", compactId],
    queryFn: () => listFn({ data: { compactId } }),
  });

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [diff, setDiff] = useState<CompactDiff | null>(null);
  const [diffing, setDiffing] = useState(false);
  const [diffErr, setDiffErr] = useState<string | null>(null);

  // Auto-select the two most recent revisions when the list loads.
  useMemo(() => {
    if (!revisions || revisions.length < 2) return;
    if (!fromId && !toId) {
      setFromId(revisions[1].id);
      setToId(revisions[0].id);
    }
  }, [revisions, fromId, toId]);

  const canCompare = !!(fromId && toId && fromId !== toId);

  async function runCompare() {
    if (!canCompare) return;
    setDiffing(true);
    setDiffErr(null);
    try {
      const res = await compareFn({ data: { compactId, fromRevisionId: fromId!, toRevisionId: toId! } });
      setDiff(res);
    } catch (e: any) {
      setDiffErr(e.message ?? String(e));
    } finally {
      setDiffing(false);
    }
  }

  if (isLoading) {
    return (
      <section className="flex items-center gap-2 rounded-2xl border border-line-200 bg-paper-0 p-5 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading revision history…
      </section>
    );
  }
  if (isError) {
    return (
      <section className="rounded-2xl border border-line-200 bg-paper-0 p-5 text-sm text-rose-600">
        Failed to load revisions: {(error as Error).message}
      </section>
    );
  }
  if (!revisions || revisions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6 text-sm text-ink-500">
        No revisions yet. Every transition (Sign / Activate / Conclude) writes a full snapshot here.
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header>
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Clock className="h-4 w-4" /> Revision history
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {revisions.length} snapshot{revisions.length === 1 ? "" : "s"} on file. Pick any two to see exactly what changed between them.
        </p>
      </header>

      <ol className="grid gap-2">
        {revisions.map((r) => (
          <RevisionRowCard
            key={r.id}
            row={r}
            selectedFrom={fromId === r.id}
            selectedTo={toId === r.id}
            onSelectFrom={() => setFromId(r.id)}
            onSelectTo={() => setToId(r.id)}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-100 pt-3">
        <p className="text-xs text-ink-500">
          {fromId && toId
            ? `Comparing r${revisions.find((r) => r.id === fromId)?.revision_number ?? "?"} → r${revisions.find((r) => r.id === toId)?.revision_number ?? "?"}`
            : "Select a From and To revision to diff."}
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={!canCompare || diffing}
          onClick={runCompare}
        >
          {diffing ? <><Loader2 className="h-4 w-4 animate-spin" /> Diffing…</> : <><GitCompare className="h-4 w-4" /> Compare</>}
        </button>
      </div>

      {diffErr && <p className="text-sm text-rose-600">{diffErr}</p>}
      {diff && <DiffView diff={diff} />}
    </section>
  );
}

function RevisionRowCard({
  row,
  selectedFrom,
  selectedTo,
  onSelectFrom,
  onSelectTo,
}: {
  row: RevisionRow;
  selectedFrom: boolean;
  selectedTo: boolean;
  onSelectFrom: () => void;
  onSelectTo: () => void;
}) {
  return (
    <li
      className={cn(
        "grid gap-2 rounded-xl border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center",
        selectedFrom || selectedTo ? "border-gold-500 bg-paper-0" : "border-line-100 bg-paper-50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-100 text-xs font-semibold text-ink-700">
          <GitCommit className="h-4 w-4" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">r{row.revision_number}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">
          {row.reason ?? (row.transition ? `Transition ${row.transition.from} → ${row.transition.to}` : "Snapshot")}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {new Date(row.created_at).toLocaleString()} · status <span className="font-mono">{row.status_at_revision ?? "—"}</span> · {row.visibility}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onSelectFrom}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
            selectedFrom ? "bg-gold-500 text-ink-950" : "bg-paper-100 text-ink-500 hover:bg-paper-0",
          )}
        >
          From
        </button>
        <button
          type="button"
          onClick={onSelectTo}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
            selectedTo ? "bg-signal-lead/30 text-ink-950" : "bg-paper-100 text-ink-500 hover:bg-paper-0",
          )}
        >
          To
        </button>
      </div>
    </li>
  );
}

function DiffView({ diff }: { diff: CompactDiff }) {
  const s = diff.summary;
  const noOp =
    s.entities_changed === 0 &&
    s.pillars_added === 0 && s.pillars_removed === 0 &&
    s.pledges_added === 0 && s.pledges_removed === 0 &&
    s.deliverables_added === 0 && s.deliverables_removed === 0;

  return (
    <div className="grid gap-3 rounded-xl border border-line-100 bg-paper-50 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">
          Δ r{diff.from.revision_number} → r{diff.to.revision_number}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
          {new Date(diff.from.created_at).toLocaleDateString()} → {new Date(diff.to.created_at).toLocaleDateString()}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Pillars +/−" value={`${s.pillars_added}/${s.pillars_removed}`} />
        <MiniStat label="Pledges +/−" value={`${s.pledges_added}/${s.pledges_removed}`} />
        <MiniStat label="Deliverables +/−" value={`${s.deliverables_added}/${s.deliverables_removed}`} />
        <MiniStat label="Entities changed" value={String(s.entities_changed)} />
      </div>

      {noOp ? (
        <p className="text-xs text-ink-500">No structural changes between these two snapshots.</p>
      ) : (
        <ul className="grid max-h-96 gap-2 overflow-y-auto pr-1">
          {diff.entities.map((e) => (
            <li
              key={`${e.kind}-${e.id}-${e.op}`}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                e.op === "added" && "border-signal-lead/40 bg-signal-lead/10",
                e.op === "removed" && "border-rose-300 bg-rose-50",
                e.op === "changed" && "border-line-100 bg-paper-0",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink-900">{e.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                  {e.kind} · {e.op}
                </span>
              </div>
              {e.changes.length > 0 && (
                <ul className="mt-1 grid gap-0.5">
                  {e.changes.map((c) => (
                    <li key={c.field} className="grid grid-cols-[8rem_1fr] gap-2 text-[11px]">
                      <span className="font-mono uppercase tracking-wide text-ink-500">{c.field}</span>
                      <span className="min-w-0 break-words text-ink-700">
                        <span className="text-rose-600 line-through">{fmt(c.from)}</span>{" "}
                        <span className="text-ink-400">→</span>{" "}
                        <span className="text-ink-900">{fmt(c.to)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper-0 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</div>
      <div className="text-base font-semibold tabular-nums text-ink-950">{value}</div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "∅";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(v);
  }
}
