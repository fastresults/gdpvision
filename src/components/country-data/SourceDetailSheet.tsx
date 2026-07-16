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
import { getSourceDetail, summarizeSource } from "@/lib/country-data/manage.functions";

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
