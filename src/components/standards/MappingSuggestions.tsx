import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import type { StandardsMappingCtx } from "@/lib/explain/standards-entries";
import {
  decideMapping,
  listMappings,
  suggestMappings,
  type MappingView,
} from "@/lib/standards/mapping.functions";
import { cn } from "@/lib/utils";

import { MICRO } from "./labels";

const DECIDED_TEXT = {
  accepted: "text-signal-positive",
  rejected: "text-ink-500",
  suggested: "text-gold-500",
} as const;

export function MappingSuggestions({
  code,
  pending,
  canApprove,
}: {
  code: string;
  pending: number;
  canApprove: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [showDecided, setShowDecided] = useState(false);

  const list = useServerFn(listMappings);
  const suggest = useServerFn(suggestMappings);
  const decide = useServerFn(decideMapping);
  const key = ["standards-mappings", code] as const;
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { code } }), enabled: open });

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["standards-audit", code] }),
    ]);
  }

  async function runSuggest() {
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const r = await suggest({ data: { code } });
      setOpen(true);
      setResult(
        r.considered === 0
          ? "No missing or partial requirements to map."
          : `Added ${r.added} suggestion${r.added === 1 ? "" : "s"}` +
              (r.skipped > 0
                ? ` · ${r.skipped} skipped (already mapped, not in the catalog, or duplicates)`
                : "") +
              ".",
      );
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function onDecide(m: MappingView, decision: "accepted" | "rejected") {
    setDeciding(m.id);
    setErr(null);
    try {
      await decide({ data: { code, mappingId: m.id, decision } });
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDeciding(null);
    }
  }

  const rows = q.data ?? [];
  const suggested = rows.filter((m) => m.status === "suggested");
  const decided = rows.filter((m) => m.status !== "suggested");

  return (
    <section className="mb-6 border-y border-line-200">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-left text-sm text-ink-950"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <span className="font-display text-lg">AI-suggested mappings</span>
          <span className={cn("tabular-nums", pending > 0 ? "text-gold-500" : "text-ink-500")}>
            ({pending})
          </span>
        </button>
        <div className="flex items-center gap-3">
          {result && <span className="text-xs text-ink-700">{result}</span>}
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            disabled={running}
            onClick={runSuggest}
          >
            {running && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {running ? "Reading the catalog…" : "Suggest mappings"}
          </button>
        </div>
      </div>
      {err && (
        <p className="mb-3 border-l-2 border-signal-negative pl-3 text-sm text-signal-negative">
          {err}
        </p>
      )}

      {open && (
        <div className="pb-4">
          <p className="mb-3 max-w-3xl text-xs text-ink-700">
            The model proposes figures this country already holds that may measure a missing or
            partial requirement.{" "}
            <Explain id="standards.mapping">
              Accepted mappings count as evidence and change the score
            </Explain>
            , so only a person with approval rights can accept or reject them.
          </p>

          {q.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-paper-50" />
              ))}
            </div>
          ) : q.error ? (
            <p className="border-l-2 border-signal-negative pl-3 text-sm text-signal-negative">
              {(q.error as Error).message}
            </p>
          ) : suggested.length === 0 ? (
            <p className="text-sm text-ink-500">
              No suggestions awaiting a decision. Use "Suggest mappings" to look for more.
            </p>
          ) : (
            <ul className="divide-y divide-line-100 border-y border-line-100">
              {suggested.map((m) => (
                <MappingItem
                  key={m.id}
                  m={m}
                  canApprove={canApprove}
                  busy={deciding === m.id}
                  onDecide={onDecide}
                />
              ))}
            </ul>
          )}

          {decided.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className="btn-ghost -ml-2 px-2 py-1 text-xs"
                onClick={() => setShowDecided((s) => !s)}
              >
                {showDecided ? "Hide" : "Show"} decided ({decided.length})
              </button>
              {showDecided && (
                <ul className="mt-2 divide-y divide-line-100 border-y border-line-100">
                  {decided.map((m) => (
                    <MappingItem
                      key={m.id}
                      m={m}
                      canApprove={false}
                      busy={false}
                      onDecide={onDecide}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MappingItem({
  m,
  canApprove,
  busy,
  onDecide,
}: {
  m: MappingView;
  canApprove: boolean;
  busy: boolean;
  onDecide: (m: MappingView, d: "accepted" | "rejected") => void;
}) {
  const ctx: StandardsMappingCtx = {
    kpiCode: m.kpiCode,
    kpiLabel: m.kpiLabel,
    confidence: m.confidence,
    rationale: m.rationale,
    status: m.status,
  };
  return (
    <li className="grid gap-3 py-3 md:grid-cols-[1.1fr_1fr_auto_auto] md:items-start md:gap-6">
      <div>
        <div className={MICRO}>
          {m.standardCode}
          {m.clause ? ` · ${m.clause}` : ""}
        </div>
        <div className="text-sm text-ink-950">{m.requirementLabel}</div>
      </div>
      <div className="text-sm">
        <div>
          <span className="font-mono text-xs text-ink-950">{m.kpiCode}</span>
          {m.kpiLabel && <span className="ml-2 text-ink-700">{m.kpiLabel}</span>}
        </div>
        <div className="text-xs text-ink-500">Latest period: {m.latestPeriod ?? "none"}</div>
        {m.rationale && <p className="mt-1 text-xs text-ink-700">{m.rationale}</p>}
      </div>
      <div className="text-sm tabular-nums">
        <div className={MICRO}>Confidence</div>
        <Explain id="standards.mapping" ctx={ctx}>
          {m.confidence == null ? "—" : `${Math.round(m.confidence * 100)}%`}
        </Explain>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {m.status !== "suggested" ? (
          <span className={cn("text-xs", DECIDED_TEXT[m.status])}>
            {m.status === "accepted" ? "Accepted" : "Rejected"}
          </span>
        ) : canApprove ? (
          <>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={busy}
              onClick={() => onDecide(m, "rejected")}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => onDecide(m, "accepted")}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              Accept
            </button>
          </>
        ) : (
          <span className="text-xs text-ink-500">Awaiting an approver</span>
        )}
      </div>
    </li>
  );
}
