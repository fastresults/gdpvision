import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { crawlSource, crawlSourceStep, getSourceDetail, listSourcePages, summarizeSource } from "@/lib/country-data/manage.functions";

export function SourceDetailSheet({
  sourceId,
  onClose,
}: {
  sourceId: string | null;
  onClose: () => void;
}) {
  const open = !!sourceId;
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getSourceDetail);
  const summarize = useServerFn(summarizeSource);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["source-detail", sourceId],
    queryFn: () => fetchDetail({ data: { id: sourceId! } }),
    enabled: open,
  });

  const regenMut = useMutation({
    mutationFn: async (force: boolean) => summarize({ data: { id: sourceId!, force } }),
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["data"] });
    },
  });

  async function ensureSummary() {
    if (!sourceId || (data?.source as any)?.summary) return;
    setBusy(true);
    setErr(null);
    try {
      await summarize({ data: { id: sourceId, force: false } });
      await refetch();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const src: any = data?.source;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{src?.title ?? "Loading…"}</SheetTitle>
          <SheetDescription className="text-xs font-mono uppercase tracking-[0.2em]">
            {src?.org} · {src?.kind}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <p className="mt-6 text-sm text-ink-500">Loading source…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-[0.15em]">
              <span
                className={`px-2 py-1 border ${src.visibility === "private" ? "border-amber-600 bg-amber-50 text-amber-800" : "border-line-200 text-ink-700"}`}
                title={src.visibility === "private" ? "Private — only your country's team can see this" : "Public — shared across the platform"}
              >
                {src.visibility === "private" ? "🔒 Private" : "Public"}
              </span>
              <span className="px-2 py-1 border border-line-200">{"★".repeat(src.quality_score)}</span>
              <span className={`px-2 py-1 border ${src.active ? "border-emerald-500 text-emerald-700" : "border-line-200 text-ink-500"}`}>
                {src.active ? "active" : "disabled"}
              </span>
              {src.connection_kind && (
                <span className="px-2 py-1 border border-line-200">{src.connection_kind}</span>
              )}
              <span className="px-2 py-1 border border-line-200">
                {(data.documents ?? []).length} docs
              </span>
              <span className="px-2 py-1 border border-line-200">
                {(data.kpis ?? []).length} KPIs
              </span>
            </div>

            {!src.url?.startsWith("lovable-storage://") && (
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-ink-500 hover:text-ink-950 break-all underline"
              >
                {src.url}
              </a>
            )}

            {/^https:\/\//i.test(src.url ?? "") && (
              <SiteReadPanel sourceId={src.id} initialStatus={src.crawl_status} initialProgress={src.crawl_progress} onChange={() => { refetch(); qc.invalidateQueries({ queryKey: ["data"] }); }} />
            )}


            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  AI summary
                </h3>
                <div className="flex gap-2">
                  {!src.summary && (
                    <button
                      onClick={ensureSummary}
                      disabled={busy}
                      className="px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
                    >
                      {busy ? "…" : "Generate"}
                    </button>
                  )}
                  {src.summary && (
                    <button
                      onClick={() => regenMut.mutate(true)}
                      disabled={regenMut.isPending}
                      className="px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] border border-line-200"
                    >
                      {regenMut.isPending ? "…" : "Regenerate"}
                    </button>
                  )}
                </div>
              </div>
              {src.summary ? (
                <p className="text-sm leading-relaxed">{src.summary}</p>
              ) : (
                <p className="text-sm text-ink-500 italic">
                  No AI summary yet. Click Generate to have Lovable AI describe what this source contributes.
                </p>
              )}
              {src.summary_generated_at && (
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-500">
                  Generated {new Date(src.summary_generated_at).toLocaleString()}
                </p>
              )}
              {(err || regenMut.error) && (
                <p className="text-xs text-red-600">{err ?? (regenMut.error as Error)?.message}</p>
              )}
            </section>

            {src.tags?.length ? (
              <section className="space-y-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Data types / tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {src.tags.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 text-[11px] border border-line-200">
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {(data.kpis ?? []).length > 0 && (
              <section className="space-y-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Powers KPIs
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.kpis.map((k: any) => (
                    <span key={k.id} className="px-2 py-0.5 text-[11px] border border-line-200" title={k.label}>
                      {k.kpi_code}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {(data.documents ?? []).length > 0 && (
              <section className="space-y-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Recent ingested documents
                </h3>
                <ul className="text-xs space-y-1">
                  {data.documents.map((d: any) => (
                    <li key={d.id} className="flex justify-between text-ink-500">
                      <span>
                        {d.chunk_count ?? 0} chunks · {(d.char_count ?? 0).toLocaleString()} chars
                      </span>
                      <span>{d.fetched_at ? new Date(d.fetched_at).toLocaleDateString() : "—"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.connection && (
              <section className="space-y-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Connection
                </h3>
                <dl className="text-xs grid grid-cols-3 gap-y-1">
                  <dt className="text-ink-500">Kind</dt>
                  <dd className="col-span-2">{(data.connection as any).kind}</dd>
                  <dt className="text-ink-500">Endpoint</dt>
                  <dd className="col-span-2 break-all">{(data.connection as any).endpoint_url}</dd>
                  {(data.connection as any).auth_header_name && (
                    <>
                      <dt className="text-ink-500">Auth header</dt>
                      <dd className="col-span-2">{(data.connection as any).auth_header_name}</dd>
                    </>
                  )}
                  {(data.connection as any).secret_ref && (
                    <>
                      <dt className="text-ink-500">Secret</dt>
                      <dd className="col-span-2 font-mono">${"{"}${(data.connection as any).secret_ref}{"}"}</dd>
                    </>
                  )}
                </dl>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SiteReadPanel({
  sourceId,
  initialStatus,
  initialProgress,
  onChange,
}: {
  sourceId: string;
  initialStatus: string | null;
  initialProgress: any;
  onChange: () => void;
}) {
  const start = useServerFn(crawlSource);
  const step = useServerFn(crawlSourceStep);
  const listPages = useServerFn(listSourcePages);
  const [limit, setLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState<any>(initialProgress && Object.keys(initialProgress).length ? initialProgress : null);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [err, setErr] = useState<string | null>(null);
  const [showPages, setShowPages] = useState(false);
  const pages = useQuery({
    queryKey: ["source-pages", sourceId],
    queryFn: () => listPages({ data: { id: sourceId } }),
    enabled: showPages,
  });

  async function loop() {
    setRunning(true);
    setErr(null);
    try {
      for (let i = 0; i < 400; i++) {
        const r: any = await step({ data: { id: sourceId } });
        setProg(r);
        setStatus(r.status);
        if (r.status !== "running") break;
        await new Promise((res) => setTimeout(res, 3000));
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setRunning(false);
      pages.refetch();
      onChange();
    }
  }

  async function begin() {
    if (!confirm(`Read up to ${limit} pages from this website? Pages already filed and unchanged are skipped.`)) return;
    setErr(null);
    try {
      await start({ data: { id: sourceId, limit } });
      setStatus("running");
      setProg(null);
      await loop();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const filed = (prog?.added ?? 0) + (prog?.updated ?? 0) + (prog?.unchanged ?? 0);
  return (
    <section className="space-y-2 border border-line-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Whole-site reading</h3>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={running}
            className="border border-line-200 px-1 py-1 text-xs bg-paper-0"
            aria-label="Page limit"
          >
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n} pages</option>)}
          </select>
          {status === "running" && !running ? (
            <button onClick={loop} className="btn-secondary">Resume</button>
          ) : (
            <button onClick={begin} disabled={running} className="btn-primary">
              {running ? "Reading…" : "Read whole site"}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-ink-500">Stays on this website. Each page is filed once; re-running skips unchanged pages.</p>
      {prog && (
        <p className="text-xs text-ink-700">
          {status === "running"
            ? `Reading… ${prog.filed ?? filed} of ${prog.total || prog.limit || "?"} pages`
            : `Read ${filed} pages · ${prog.chunks ?? 0} passages · ${prog.skipped ?? 0} skipped`}
          {" "}· {prog.added ?? 0} new · {prog.updated ?? 0} updated · {prog.unchanged ?? 0} unchanged
          {(prog.failed?.length ?? 0) > 0 && ` · ${prog.failed.length} failed`}
        </p>
      )}
      {(prog?.failed?.length ?? 0) > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-500">Failed pages</summary>
          <ul className="mt-1 space-y-1">
            {prog.failed.map((f: any, i: number) => (
              <li key={i} className="break-all">{f.url} — {f.error}</li>
            ))}
          </ul>
        </details>
      )}
      {err && <p className="text-xs text-signal-negative">{err}</p>}
      <button onClick={() => setShowPages((v) => !v)} className="btn-ghost">
        {showPages ? "Hide pages" : "Show filed pages"}
      </button>
      {showPages && (
        <ul className="max-h-64 overflow-y-auto text-xs divide-y divide-line-100">
          {(pages.data ?? []).map((p: any) => (
            <li key={p.id} className="py-1 flex justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate">{p.page_title || "(untitled page)"}</span>
                <span className="block truncate text-ink-500">{p.page_url ? p.page_url.replace(/^https?:\/\//, "") : "(single page)"}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-500">{p.chunk_count ?? 0} passages</span>
            </li>
          ))}
          {pages.data && pages.data.length === 0 && <li className="py-1 text-ink-500">No pages filed yet.</li>}
        </ul>
      )}
    </section>
  );
}
