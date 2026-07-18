import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";

import { deleteFeed, listFeeds, suggestFeeds, testFeed, upsertFeed, type FeedRow } from "@/lib/press-monitor.functions";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SCOPES = ["local", "regional", "international"] as const;
const KINDS = ["rss", "json", "gdelt", "google_news", "html"] as const;

export function SignalSourcesPanel({ code, countryName }: { code: string; countryName: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listFeeds);
  const upsert = useServerFn(upsertFeed);
  const del = useServerFn(deleteFeed);
  const test = useServerFn(testFeed);

  const feeds = useQuery({
    queryKey: ["narrative-feeds", code],
    queryFn: () => list({ data: { countryCode: code } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["narrative-feeds", code] });

  const testM = useMutation({ mutationFn: (id: string) => test({ data: { id } }) });
  const delM = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: invalidate });
  const upsertM = useMutation({
    mutationFn: (row: { id?: string; scope: typeof SCOPES[number]; kind: typeof KINDS[number]; endpoint: string; label?: string }) =>
      upsert({ data: { countryCode: code, ...row } }),
    onSuccess: invalidate,
  });

  const rows = feeds.data ?? [];
  const grouped = SCOPES.map((s) => ({ scope: s, items: rows.filter((r) => r.scope === s) }));

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Signal sources</p>
          <h3 className="mt-1 font-serif text-2xl text-ink-950">What the radar listens to</h3>
          <p className="mt-1 text-sm text-ink-700">
            {rows.length} feeds across {SCOPES.length} scopes. Only these endpoints run in the twice-daily harvester.
          </p>
        </div>
        <div className="flex gap-2">
          <SuggestButton code={code} countryName={countryName} onImport={(row) => upsertM.mutate(row)} />
          <AddFeedDialog onSave={(row) => upsertM.mutate(row)} />
        </div>
      </header>

      {grouped.map(({ scope, items }) => (
        <div key={scope} className="border border-line-200">
          <div className="flex items-center justify-between border-b border-line-200 bg-paper-100/40 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{scope} · {items.length}</p>
          </div>
          {items.length === 0 ? (
            <p className="p-3 text-sm text-ink-500">No {scope} feeds configured yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                <tr className="border-b border-line-200">
                  <th className="px-3 py-2 text-left">Label / endpoint</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Last poll</th>
                  <th className="px-3 py-2 text-left">Health</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-line-200 align-top last:border-b-0">
                    <td className="max-w-md px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink-950">{r.label ?? r.endpoint}</span>
                        <LayerChip row={r} />
                      </div>
                      <a href={r.endpoint} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-[11px] text-ink-500 hover:text-ink-950">
                        <ExternalLink size={10} /> <span className="truncate">{r.endpoint}</span>
                      </a>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">{r.kind}</td>
                    <td className="px-3 py-2 text-[11px] text-ink-500">
                      {r.last_polled_at ? new Date(r.last_polled_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        "inline-block border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                        !r.active ? "border-rose-500/50 bg-rose-50 text-rose-700" :
                        r.last_status === "ok" ? "border-emerald-600/50 bg-emerald-50 text-emerald-800" :
                        r.last_status === "not_modified" ? "border-line-200 bg-paper-100 text-ink-500" :
                        r.last_status === "error" ? "border-amber-500/50 bg-amber-50 text-amber-800" :
                        "border-line-200 text-ink-500")}
                      >
                        {!r.active ? "muted" : r.last_status ?? "pending"}
                      </span>
                      {r.consecutive_failures > 0 && (
                        <span className="ml-2 font-mono text-[10px] text-rose-600">×{r.consecutive_failures}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <TestButton onClick={() => testM.mutate(r.id)} pending={testM.isPending && testM.variables === r.id} />
                      <button
                        onClick={() => upsertM.mutate({ id: r.id, scope: r.scope, kind: r.kind, endpoint: r.endpoint, label: r.label ?? undefined })}
                        className="ml-1 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-700 hover:border-ink-950"
                        title="Save (no-op edit; opens editor via row)"
                      >
                        {r.active ? "Mute" : "Enable"}
                      </button>
                      <button onClick={() => { if (confirm("Delete this feed?")) delM.mutate(r.id); }}
                        className="ml-1 border border-rose-500/40 bg-rose-50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-rose-700 hover:border-rose-600">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {testM.data && (
        <div className="border border-emerald-600/40 bg-emerald-50 p-3 text-sm text-emerald-900">
          Test → {testM.data.status} · {testM.data.count} items{testM.data.error ? ` · ${testM.data.error}` : ""}
          {testM.data.sample?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {testM.data.sample.map((s, i) => (
                <li key={i} className="truncate text-[12px]">• {s.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TestButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button onClick={onClick} disabled={pending}
      className="border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-700 hover:border-ink-950 disabled:opacity-50">
      {pending ? <Loader2 size={11} className="animate-spin" /> : "Test"}
    </button>
  );
}

function AddFeedDialog({ onSave }: { onSave: (row: { scope: typeof SCOPES[number]; kind: typeof KINDS[number]; endpoint: string; label?: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<typeof SCOPES[number]>("local");
  const [kind, setKind] = useState<typeof KINDS[number]>("rss");
  const [endpoint, setEndpoint] = useState("");
  const [label, setLabel] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 border border-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:bg-paper-100">
          <Plus size={12} /> Add feed
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a signal source</DialogTitle>
          <DialogDescription>RSS, JSON feed, GDELT DOC 2.0, Google News search URL, or HTML page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="grid gap-1"><span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="border border-line-200 px-3 py-2 text-sm" placeholder="Ministry of Finance press releases" /></label>
          <label className="grid gap-1"><span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Endpoint URL</span>
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="border border-line-200 px-3 py-2 text-sm" placeholder="https://…" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1"><span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Scope</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as typeof SCOPES[number])} className="border border-line-200 px-3 py-2 text-sm">
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="grid gap-1"><span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Kind</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof KINDS[number])} className="border border-line-200 px-3 py-2 text-sm">
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select></label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!endpoint} onClick={() => { onSave({ scope, kind, endpoint, label: label || undefined }); setOpen(false); setEndpoint(""); setLabel(""); }}>Save feed</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestButton({ code, countryName, onImport }: { code: string; countryName: string; onImport: (row: { scope: typeof SCOPES[number]; kind: typeof KINDS[number]; endpoint: string; label?: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const suggest = useServerFn(suggestFeeds);
  const m = useMutation({
    mutationFn: () => suggest({ data: { countryCode: code, countryName } }),
    onSuccess: () => setPicked(new Set()),
  });
  const items = m.data?.suggestions ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) m.mutate(); }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-700 hover:border-ink-950">
          <Sparkles size={12} /> Suggest with AI
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI-suggested feeds for {countryName}</DialogTitle>
          <DialogDescription>Perplexity proposes 15 press-monitoring endpoints. Pick which to import.</DialogDescription>
        </DialogHeader>
        {m.isPending && <p className="text-sm text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Researching…</p>}
        {m.error && <p className="text-sm text-rose-600">{(m.error as Error).message}</p>}
        {items.length > 0 && (
          <ul className="max-h-80 divide-y divide-line-200 overflow-y-auto border border-line-200">
            {items.map((s, i) => {
              const on = picked.has(i);
              return (
                <li key={i} className="flex items-start gap-2 p-2">
                  <button onClick={() => { const n = new Set(picked); on ? n.delete(i) : n.add(i); setPicked(n); }}
                    className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center border", on ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200")}>
                    {on ? <Check size={12} /> : <X size={12} className="opacity-0" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-950">{s.label ?? s.endpoint}</p>
                    <p className="truncate font-mono text-[10px] text-ink-500">{s.scope} · {s.kind} · {s.endpoint}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button disabled={picked.size === 0} onClick={() => {
            picked.forEach((i) => {
              const s = items[i];
              onImport({
                scope: (s.scope as typeof SCOPES[number]) ?? "local",
                kind: (s.kind as typeof KINDS[number]) ?? "rss",
                endpoint: s.endpoint,
                label: s.label,
              });
            });
            setOpen(false);
          }}>Import {picked.size}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
