import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import {
  Search, Filter, Copy, Trash2, ExternalLink, FileText, Star, Tag as TagIcon,
  Download, History, Send, ArrowUpRight,
} from "lucide-react";

import {
  searchComms, getCommsDetail, updateCommsMeta, duplicateComms, deleteComms,
  listCommsFacets,
} from "@/lib/narrative.functions";
import { cn } from "@/lib/utils";
import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_META } from "@/lib/narrative-priority";

const STATES = ["draft", "review", "approved", "released"] as const;
type DraftState = (typeof STATES)[number];

const STATE_TONE: Record<DraftState, string> = {
  draft: "bg-ink-100 text-ink-700 border-line-200",
  review: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-sky-50 text-sky-800 border-sky-200",
  released: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export const Route = createFileRoute("/_authenticated/admin/countries/$code/narrative/library")({
  head: ({ params }) => ({
    meta: [
      { title: `Comms Library · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { code } = Route.useParams();
  const [q, setQ] = useState("");
  const [states, setStates] = useState<DraftState[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [tagsSel, setTagsSel] = useState<string[]>([]);
  const [sort, setSort] = useState<"updated" | "released" | "channel">("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listOpts = useMemo(
    () =>
      queryOptions({
        queryKey: ["comms-library", code, q, states, channels, tagsSel, sort],
        queryFn: () =>
          searchComms({
            data: {
              scopeKey: code,
              q: q || undefined,
              states: states.length ? states : undefined,
              channels: channels.length ? channels : undefined,
              tags: tagsSel.length ? tagsSel : undefined,
              sort,
              limit: 100,
              offset: 0,
            },
          }),
      }),
    [code, q, states, channels, tagsSel, sort],
  );
  const listQ = useQuery(listOpts);

  const facetsQ = useQuery(
    queryOptions({
      queryKey: ["comms-library-facets", code],
      queryFn: () => listCommsFacets({ data: { scopeKey: code } }),
    }),
  );

  const rows = listQ.data ?? [];
  const activeId = selectedId ?? rows[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Chamber 05 · Library
        </p>
        <h2 className="mt-1 font-serif text-3xl text-ink-950">Comms Library</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-700">
          Every press release, PM statement, LinkedIn post, and diplomatic memo drafted for
          this country — searchable, taggable, and audit-tracked.
        </p>
      </header>

      {/* Search + top filters */}
      <div className="border border-line-200 bg-paper-0 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" size={14} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, body, audience…"
              className="pl-8"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="border border-line-200 bg-paper-0 px-2 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-950"
          >
            <option value="updated">Sort: updated</option>
            <option value="released">Sort: released</option>
            <option value="channel">Sort: channel</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATES.map((s) => {
            const active = states.includes(s);
            const count = facetsQ.data?.states?.[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() =>
                  setStates((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]))
                }
                className={cn(
                  "border px-2 py-1 font-mono text-[10px] uppercase tracking-widest",
                  active ? STATE_TONE[s] : "border-line-200 text-ink-700 hover:border-ink-500",
                )}
              >
                {s} · {count}
              </button>
            );
          })}
        </div>

        {(facetsQ.data?.channels?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={11} className="text-ink-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Channel:</span>
            {facetsQ.data!.channels.map((c) => {
              const active = channels.includes(c);
              return (
                <button
                  key={c}
                  onClick={() =>
                    setChannels((prev) => (active ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                  className={cn(
                    "border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                    active
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : "border-line-200 text-ink-700 hover:border-ink-500",
                  )}
                >
                  {c.replace(/[_-]/g, " ")}
                </button>
              );
            })}
          </div>
        )}

        {(facetsQ.data?.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <TagIcon size={11} className="text-ink-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Tags:</span>
            {facetsQ.data!.tags.slice(0, 20).map((t) => {
              const active = tagsSel.includes(t);
              return (
                <button
                  key={t}
                  onClick={() =>
                    setTagsSel((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
                  }
                  className={cn(
                    "border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                    active
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : "border-line-200 text-ink-700 hover:border-ink-500",
                  )}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Split list + detail */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="min-w-0 border border-line-200 bg-paper-0">
          <div className="border-b border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {listQ.isLoading ? "Loading…" : `${rows.length} result${rows.length === 1 ? "" : "s"}`}
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-line-200">
            {rows.length === 0 && !listQ.isLoading && (
              <div className="p-6 text-center text-sm text-ink-500">
                <FileText size={24} className="mx-auto text-ink-500" strokeWidth={1.5} />
                <p className="mt-2">No drafts match your filters.</p>
              </div>
            )}
            {rows.map((r) => {
              const priorityMeta = r.signal_priority ? PRIORITY_META[r.signal_priority as 1 | 2 | 3 | 4 | 5] : null;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "block w-full text-left p-3 hover:bg-paper-50",
                    activeId === r.id && "bg-paper-100",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-serif text-sm leading-tight text-ink-950 line-clamp-2">
                      {r.title}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest",
                        STATE_TONE[r.draft_state as DraftState],
                      )}
                    >
                      {r.draft_state}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-ink-700">{r.snippet}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-ink-500">
                    <span>{r.channel.replace(/[_-]/g, " ")}</span>
                    <span>·</span>
                    <span>{r.audience}</span>
                    {priorityMeta && (
                      <>
                        <span>·</span>
                        <span className={priorityMeta.textClass}>{priorityMeta.label}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}</span>
                    {r.is_template && (
                      <>
                        <span>·</span>
                        <span className="text-amber-700">★ template</span>
                      </>
                    )}
                  </div>
                  {r.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.tags.slice(0, 4).map((t) => (
                        <span key={t} className="border border-line-200 px-1 py-0 font-mono text-[9px] text-ink-700">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="min-w-0">
          {activeId ? (
            <CommsDetail id={activeId} code={code} onDeleted={() => setSelectedId(null)} />
          ) : (
            <div className="border border-dashed border-line-200 p-8 text-center text-sm text-ink-500">
              Select a draft to preview it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommsDetail({ id, code, onDeleted }: { id: string; code: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const detailOpts = queryOptions({
    queryKey: ["comms-detail", id],
    queryFn: () => getCommsDetail({ data: { id } }),
  });
  const detailQ = useQuery(detailOpts);

  const updateMeta = useServerFn(updateCommsMeta);
  const dupFn = useServerFn(duplicateComms);
  const delFn = useServerFn(deleteComms);

  const updateM = useMutation({
    mutationFn: (input: { title?: string; tags?: string[]; isTemplate?: boolean }) =>
      updateMeta({ data: { id, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms-detail", id] });
      qc.invalidateQueries({ queryKey: ["comms-library", code] });
      qc.invalidateQueries({ queryKey: ["comms-library-facets", code] });
    },
  });
  const dupM = useMutation({
    mutationFn: (asTemplate: boolean) => dupFn({ data: { id, asTemplate } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms-library", code] });
    },
  });
  const delM = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms-library", code] });
      onDeleted();
    },
  });

  const [tab, setTab] = useState<"body" | "approvals" | "history">("body");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  if (detailQ.isLoading) {
    return <div className="border border-line-200 p-6 text-sm text-ink-500">Loading…</div>;
  }
  if (detailQ.error) {
    return <div className="border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{(detailQ.error as Error).message}</div>;
  }
  const d = detailQ.data!;
  const a = d.artifact;
  const currentTitle = titleDraft ?? a.title ?? "Untitled draft";
  const approvals = Array.isArray(a.approvals) ? (a.approvals as Array<Record<string, unknown>>) : [];
  const sources = d.strategySources as Array<{ url?: string; title?: string; publisher?: string }>;

  const download = () => {
    const md = `# ${a.title ?? "Draft"}\n\n${a.body}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(a.title ?? "draft").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-line-200 bg-paper-0">
      {/* Header */}
      <div className="border-b border-line-200 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              value={currentTitle}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft !== null && titleDraft !== a.title) {
                  updateM.mutate({ title: titleDraft });
                }
                setTitleDraft(null);
              }}
              className="w-full bg-transparent font-serif text-xl text-ink-950 focus:outline-none"
            />
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <span className={cn("border px-1.5 py-0.5", STATE_TONE[a.draft_state as DraftState])}>
                {a.draft_state}
              </span>
              <span>{a.channel.replace(/[_-]/g, " ")}</span>
              <span>· {a.audience}</span>
              <span>· updated {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}</span>
              {a.released_at && <span>· released {formatDistanceToNow(new Date(a.released_at), { addSuffix: true })}</span>}
            </div>
            {d.signal && (
              <Link
                to="/admin/countries/$code/narrative/signal/$id"
                params={{ code, id: d.signal.id }}
                className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950"
              >
                <ArrowUpRight size={11} /> Signal · {d.signal.topic ?? "untitled"}
              </Link>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(a.body ?? "")}>
                <Copy size={12} /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={download}>
                <Download size={12} /> .md
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateM.mutate({ isTemplate: !a.is_template })}
                title={a.is_template ? "Unpin template" : "Pin as template"}
              >
                <Star size={12} className={a.is_template ? "fill-amber-500 text-amber-500" : ""} /> Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => dupM.mutate(false)}>
                <Copy size={12} /> Duplicate
              </Button>
              {a.draft_state !== "released" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    if (confirm("Move draft to trash?")) delM.mutate();
                  }}
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
            {a.published_url && (
              <a
                href={a.published_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700 hover:text-emerald-900"
              >
                <ExternalLink size={11} /> Published
              </a>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TagIcon size={11} className="text-ink-500" />
          {((a.tags ?? []) as string[]).map((t) => (
            <span key={t} className="group flex items-center gap-1 border border-line-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-700">
              #{t}
              <button
                onClick={() =>
                  updateM.mutate({ tags: ((a.tags ?? []) as string[]).filter((x) => x !== t) })
                }
                className="text-ink-500 opacity-0 group-hover:opacity-100"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagDraft.trim()) {
                const next = Array.from(new Set([...(a.tags ?? []) as string[], tagDraft.trim().toLowerCase()]));
                updateM.mutate({ tags: next });
                setTagDraft("");
              }
            }}
            placeholder="add tag…"
            className="border border-dashed border-line-200 bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-ink-700 focus:outline-none focus:border-ink-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-line-200 px-2">
        {(["body", "approvals", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]",
              tab === t ? "border-ink-950 text-ink-950" : "border-transparent text-ink-500 hover:text-ink-950",
            )}
          >
            {t === "body" ? "Body" : t === "approvals" ? `Approvals · ${approvals.length}` : `History · ${d.revisions.length}`}
          </button>
        ))}
      </nav>

      <div className="max-h-[60vh] overflow-y-auto p-4">
        {tab === "body" && (
          <article className="prose prose-sm max-w-none">
            <CitedMarkdown
              text={a.body ?? ""}
              citations={sources.map((s, i) => ({
                n: i + 1,
                url: s.url ?? "",
                title: s.title,
                publisher: s.publisher,
              }))}
            />
          </article>
        )}
        {tab === "approvals" && (
          <div className="space-y-3">
            {approvals.length === 0 ? (
              <p className="text-sm text-ink-500">No approvals recorded. Submit for review from the signal workspace.</p>
            ) : (
              approvals.map((entry, i) => (
                <div key={i} className="border border-line-200 p-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    <Send size={11} />
                    <span>{String(entry.from ?? "?")} → {String(entry.to ?? "?")}</span>
                    <span>·</span>
                    <span>{entry.at ? formatDistanceToNow(new Date(String(entry.at)), { addSuffix: true }) : ""}</span>
                  </div>
                  {typeof entry.note === "string" && entry.note && (
                    <p className="mt-2 text-sm text-ink-700">{entry.note}</p>
                  )}
                  {Array.isArray(entry.figures) && entry.figures.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(entry.figures as unknown[]).map((f, j) => (
                        <Badge key={j} variant="secondary">{String(f)}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {tab === "history" && (
          <div className="space-y-2">
            {d.revisions.length === 0 ? (
              <p className="text-sm text-ink-500">No prior revisions. Every future edit is captured here automatically.</p>
            ) : (
              d.revisions.map((r) => (
                <details key={r.id} className="border border-line-200 p-3">
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    <History size={11} className="mr-1 inline" />
                    {formatDistanceToNow(new Date(r.edited_at), { addSuffix: true })} ·{" "}
                    {(r.body ?? "").length.toLocaleString()} chars
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-ink-800">
                    {r.body}
                  </pre>
                </details>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
