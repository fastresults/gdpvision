import { useState } from "react";

export type MemoryDraft = {
  sector_code: string;
  kind: string;
  title: string;
  body: string;
  weight: number;
  verified?: boolean;
  scope?: "country" | "national";
  citation_url?: string | null;
  source_id?: string | null;
  _keep?: boolean;
};

const KINDS = ["audience", "position", "statement", "outlet", "precedent", "fact", "risk"];

export function MemoryDraftReview({
  drafts,
  setDrafts,
  onCommit,
  busy,
  sourceHint,
}: {
  drafts: MemoryDraft[];
  setDrafts: (d: MemoryDraft[]) => void;
  onCommit: () => void;
  busy: boolean;
  sourceHint?: string;
}) {
  const kept = drafts.filter((d) => d._keep !== false).length;
  const [filter, setFilter] = useState("");

  if (drafts.length === 0) {
    return (
      <div className="border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
        No draft memories were extracted. Try different input or a stronger sector hint.
      </div>
    );
  }

  const update = (i: number, patch: Partial<MemoryDraft>) => {
    const next = drafts.slice();
    next[i] = { ...next[i], ...patch };
    setDrafts(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-ink-500">
          {kept} of {drafts.length} drafts selected
          {sourceHint && <span> · from <span className="font-mono">{sourceHint}</span></span>}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-line-200 px-2 py-1 text-xs bg-paper-0"
          />
          <button
            onClick={() => setDrafts(drafts.map((d) => ({ ...d, _keep: true })))}
            className="text-[11px] font-mono uppercase tracking-widest px-2 py-1 border border-line-200"
          >
            Keep all
          </button>
          <button
            onClick={() => setDrafts(drafts.map((d) => ({ ...d, _keep: false })))}
            className="text-[11px] font-mono uppercase tracking-widest px-2 py-1 border border-line-200"
          >
            Skip all
          </button>
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
        {drafts.map((d, i) => {
          const hidden = filter && !`${d.title} ${d.body} ${d.sector_code} ${d.kind}`.toLowerCase().includes(filter.toLowerCase());
          if (hidden) return null;
          const keep = d._keep !== false;
          return (
            <div key={i} className={`border p-2 space-y-2 ${keep ? "border-line-200 bg-paper-0" : "border-line-200 bg-paper-100/30 opacity-60"}`}>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest">
                  <input type="checkbox" checked={keep} onChange={(e) => update(i, { _keep: e.target.checked })} />
                  keep
                </label>
                <input
                  value={d.sector_code}
                  onChange={(e) => update(i, { sector_code: e.target.value })}
                  className="border border-line-200 px-2 py-1 text-xs bg-paper-0 w-40"
                  placeholder="sector"
                />
                <select
                  value={d.kind}
                  onChange={(e) => update(i, { kind: e.target.value })}
                  className="border border-line-200 px-2 py-1 text-xs bg-paper-0"
                >
                  {KINDS.map((k) => <option key={k}>{k}</option>)}
                </select>
                <select
                  value={d.weight}
                  onChange={(e) => update(i, { weight: Number(e.target.value) })}
                  className="border border-line-200 px-2 py-1 text-xs bg-paper-0"
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>weight {n}</option>)}
                </select>
                <select
                  value={d.scope ?? "country"}
                  onChange={(e) => update(i, { scope: e.target.value as any })}
                  className="border border-line-200 px-2 py-1 text-xs bg-paper-0"
                >
                  <option value="country">country</option>
                  <option value="national">national</option>
                </select>
                <label className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest ml-auto">
                  <input type="checkbox" checked={!!d.verified} onChange={(e) => update(i, { verified: e.target.checked })} />
                  verified
                </label>
              </div>
              <input
                value={d.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className="w-full border border-line-200 px-2 py-1 text-sm bg-paper-0 font-medium"
              />
              <textarea
                value={d.body}
                onChange={(e) => update(i, { body: e.target.value })}
                rows={3}
                className="w-full border border-line-200 px-2 py-1 text-sm bg-paper-0"
              />
              {d.citation_url && (
                <div className="text-[11px] text-ink-500 truncate">↳ {d.citation_url}</div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onCommit}
        disabled={busy || kept === 0}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        {busy ? "Committing…" : `Commit ${kept} memor${kept === 1 ? "y" : "ies"}`}
      </button>
    </div>
  );
}
