import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import {
  Search, Copy, Trash2, ExternalLink, FileText, Star, Tag as TagIcon,
  Download, MoreHorizontal, Sparkles, Wand2, Pencil, Save, X as XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  searchComms, getCommsDetail, updateCommsMeta, duplicateComms, deleteComms,
  listCommsFacets, saveCommsAsTemplate, updateCommsBody, backfillCommsTitles,
} from "@/lib/narrative.functions";
import { cn } from "@/lib/utils";
import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIORITY_META } from "@/lib/narrative-priority";
import { TriageCards, type SmartView } from "@/components/narrative/comms/TriageCards";
import { WorkflowRail } from "@/components/narrative/comms/WorkflowRail";
import { ContextRibbon } from "@/components/narrative/comms/ContextRibbon";
import { LibraryCoach } from "@/components/narrative/comms/LibraryCoach";
import { ScheduleDialog } from "@/components/narrative/comms/ScheduleDialog";
import { UnifiedTimeline } from "@/components/narrative/comms/UnifiedTimeline";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  errorComponent: LibraryError,
  notFoundComponent: () => (
    <div className="border border-line-200 bg-paper-0 p-6 text-sm text-ink-700">
      Nothing to show here.
    </div>
  ),
});

function LibraryError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-widest">Comms library failed to load</div>
      <p className="text-rose-900">{error.message}</p>
      <Button size="sm" variant="outline" onClick={() => reset()}>Retry</Button>
    </div>
  );
}

type TabKey = "drafts" | "templates";

function LibraryPage() {
  const { code } = Route.useParams();
  const [tab, setTab] = useState<TabKey>("drafts");
  const [smart, setSmart] = useState<SmartView>(null);
  const [q, setQ] = useState("");
  const [states, setStates] = useState<DraftState[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [sort, setSort] = useState<"updated" | "released" | "channel">("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Persist filters per country
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`comms-lib-${code}`);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.states) setStates(s.states);
        if (s.channels) setChannels(s.channels);
        if (s.sort) setSort(s.sort);
      }
    } catch { /* noop */ }
  }, [code]);
  useEffect(() => {
    try {
      localStorage.setItem(`comms-lib-${code}`, JSON.stringify({ states, channels, sort }));
    } catch { /* noop */ }
  }, [code, states, channels, sort]);

  const smartFilter = useMemo(() => {
    switch (smart) {
      case "needs_you": return { states: ["review", "approved"] as DraftState[], isTemplate: false };
      case "in_review": return { states: ["review"] as DraftState[], isTemplate: false };
      case "recently_released": return { states: ["released"] as DraftState[], isTemplate: false };
      case "scheduled": return { states: undefined, isTemplate: false }; // client filter
      default: return {};
    }
  }, [smart]);

  const effStates = smart ? smartFilter.states : (states.length ? states : undefined);
  const effIsTemplate = tab === "templates" ? true : (smart ? smartFilter.isTemplate : undefined);

  const listOpts = useMemo(
    () =>
      queryOptions({
        queryKey: ["comms-library", code, tab, smart, q, effStates, channels, sort],
        queryFn: () =>
          searchComms({
            data: {
              scopeKey: code,
              q: q || undefined,
              states: effStates,
              channels: channels.length ? channels : undefined,
              isTemplate: effIsTemplate,
              sort,
              limit: 100,
              offset: 0,
            },
          }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, tab, smart, q, JSON.stringify(effStates), channels, sort, effIsTemplate],
  );
  const listQ = useQuery(listOpts);

  const facetsQ = useQuery(
    queryOptions({
      queryKey: ["comms-library-facets", code],
      queryFn: () => listCommsFacets({ data: { scopeKey: code } }),
    }),
  );

  const rows = listQ.data ?? [];
  const activeId = selectedId ?? (listQ.isSuccess ? rows[0]?.id ?? null : null);

  const qc = useQueryClient();
  const backfillFn = useServerFn(backfillCommsTitles);
  const backfillM = useMutation({
    mutationFn: () => backfillFn({ data: { scopeKey: code } }),
    onSuccess: (r) => {
      toast.success(`Renamed ${r.updated} draft${r.updated === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["comms-library", code] });
      qc.invalidateQueries({ queryKey: ["comms-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Chamber 05 · Library
          </p>
          <h2 className="mt-1 font-serif text-3xl text-ink-950">Comms Library</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            Track every draft from signal → statement → release. Reuse what worked; audit what shipped.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => backfillM.mutate()}
          disabled={backfillM.isPending}
          title="Auto-rename any 'Untitled' drafts using their strategy + channel"
        >
          <Wand2 size={12} className="mr-1.5" />
          {backfillM.isPending ? "Renaming…" : "Fix titles"}
        </Button>
      </header>


      <LibraryCoach code={code} />

      {/* Triage cards */}
      <TriageCards code={code} active={smart} onChange={(v) => { setSmart(v); setTab("drafts"); }} />

      {/* Tabs: Drafts / Templates */}
      <div className="flex items-center justify-between gap-3 border-b border-line-200">
        <nav className="flex gap-1">
          {(["drafts", "templates"] as const).map((k) => (
            <button
              key={k}
              onClick={() => { setTab(k); setSmart(null); }}
              className={cn(
                "border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]",
                tab === k ? "border-ink-950 text-ink-950" : "border-transparent text-ink-500 hover:text-ink-950",
              )}
            >
              {k === "drafts" ? "Drafts" : "Templates"}
            </button>
          ))}
        </nav>
        {smart && (
          <button
            onClick={() => setSmart(null)}
            className="text-[11px] text-ink-500 hover:text-ink-950 underline"
          >
            Clear smart view
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
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

        {tab === "drafts" && !smart && (
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
        )}

        {(facetsQ.data?.channels?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
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
      </div>

      {/* Split list + detail */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="min-w-0 border border-line-200 bg-paper-0">
          <div className="border-b border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {listQ.isLoading ? "Loading…" : `${rows.length} ${tab === "templates" ? "template" : "draft"}${rows.length === 1 ? "" : "s"}`}
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-line-200">
            {rows.length === 0 && !listQ.isLoading && (
              <EmptyList tab={tab} smart={smart} onReset={() => { setSmart(null); setStates([]); setChannels([]); setQ(""); }} />
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
                      {r.is_template ? "template" : r.draft_state}
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
                        <span className={priorityMeta.pillClass.split(" ").find((c) => c.startsWith("text-")) ?? ""}>{priorityMeta.label}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}</span>
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
            <CommsDetail id={activeId} code={code} onDeleted={() => setSelectedId(null)} isTemplateTab={tab === "templates"} />
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

function EmptyList({ tab, smart, onReset }: { tab: TabKey; smart: SmartView; onReset: () => void }) {
  if (tab === "templates") {
    return (
      <div className="p-6 text-center text-sm text-ink-500">
        <Star size={24} className="mx-auto text-ink-500" strokeWidth={1.5} />
        <p className="mt-2 text-ink-700">No templates yet.</p>
        <p className="mt-1 text-[12px]">Open a released or approved draft and hit <b>Save as template</b>.</p>
      </div>
    );
  }
  return (
    <div className="p-6 text-center text-sm text-ink-500">
      <FileText size={24} className="mx-auto text-ink-500" strokeWidth={1.5} />
      <p className="mt-2">{smart ? "Nothing in this view right now." : "No drafts match your filters."}</p>
      <button className="mt-2 text-[11px] underline text-ink-700" onClick={onReset}>Reset filters</button>
    </div>
  );
}

function CommsDetail({ id, code, onDeleted, isTemplateTab }: { id: string; code: string; onDeleted: () => void; isTemplateTab: boolean }) {
  const qc = useQueryClient();
  const detailOpts = queryOptions({
    queryKey: ["comms-detail", id],
    queryFn: () => getCommsDetail({ data: { id } }),
  });
  const detailQ = useQuery(detailOpts);

  const updateMeta = useServerFn(updateCommsMeta);
  const dupFn = useServerFn(duplicateComms);
  const delFn = useServerFn(deleteComms);
  const saveTplFn = useServerFn(saveCommsAsTemplate);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["comms-detail", id] });
    qc.invalidateQueries({ queryKey: ["comms-library", code] });
    qc.invalidateQueries({ queryKey: ["comms-library-facets", code] });
    qc.invalidateQueries({ queryKey: ["comms-workflow-counts", code] });
  };

  const updateM = useMutation({
    mutationFn: (input: { title?: string; tags?: string[]; isTemplate?: boolean }) =>
      updateMeta({ data: { id, ...input } }),
    onSuccess: invalidateAll,
  });
  const dupM = useMutation({
    mutationFn: (asTemplate: boolean) => dupFn({ data: { id, asTemplate } }),
    onSuccess: (res) => {
      invalidateAll();
      toast.success("Duplicated");
      void res;
    },
  });
  const saveTplM = useMutation({
    mutationFn: () => saveTplFn({ data: { id } }),
    onSuccess: () => { invalidateAll(); toast.success("Saved as template"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => { invalidateAll(); onDeleted(); toast.success("Moved to trash"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [tab, setTab] = useState<"body" | "history">("body");
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
          </div>
          <div className="flex items-center gap-1.5">
            {isTemplateTab ? (
              <Button
                size="sm"
                onClick={() => dupM.mutate(false)}
                className="bg-ink-950 text-paper-0 hover:bg-ink-800"
              >
                <Wand2 size={12} className="mr-1" /> Use template
              </Button>
            ) : (
              a.draft_state === "approved" && (
                <ScheduleDialog artifactId={id} scopeKey={code} current={(a as { scheduled_for?: string | null }).scheduled_for ?? null} />
              )
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" aria-label="More">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(a.body ?? ""); toast.success("Copied"); }}>
                  <Copy size={12} className="mr-2" /> Copy body
                </DropdownMenuItem>
                <DropdownMenuItem onClick={download}>
                  <Download size={12} className="mr-2" /> Download .md
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => dupM.mutate(false)}>
                  <Copy size={12} className="mr-2" /> Duplicate
                </DropdownMenuItem>
                {!a.is_template && (
                  <DropdownMenuItem onClick={() => saveTplM.mutate()}>
                    <Sparkles size={12} className="mr-2" /> Save as template
                  </DropdownMenuItem>
                )}
                {a.is_template && (
                  <DropdownMenuItem onClick={() => updateM.mutate({ isTemplate: false })}>
                    <Star size={12} className="mr-2" /> Unpin template
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {a.draft_state !== "released" && (
                  <DropdownMenuItem
                    className="text-rose-700 focus:text-rose-800"
                    onClick={() => {
                      if (confirm("Move draft to trash?")) delM.mutate();
                    }}
                  >
                    <Trash2 size={12} className="mr-2" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Workflow rail (skip for templates) */}
        {!a.is_template && (
          <WorkflowRail
            artifactId={id}
            state={a.draft_state as DraftState}
            scopeKey={code}
          />
        )}

        {/* Context ribbon */}
        <ContextRibbon
          code={code}
          signal={d.signal}
          strategyId={a.strategy_id ?? null}
          channel={a.channel ?? ""}
          audience={a.audience ?? ""}
        />

        {a.published_url && (
          <a
            href={a.published_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700 hover:text-emerald-900"
          >
            <ExternalLink size={11} /> View published
          </a>
        )}

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
        {(["body", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]",
              tab === t ? "border-ink-950 text-ink-950" : "border-transparent text-ink-500 hover:text-ink-950",
            )}
          >
            {t === "body" ? "Body" : `Activity · ${approvals.length + d.revisions.length}`}
          </button>
        ))}
      </nav>

      <div className="max-h-[60vh] overflow-y-auto p-4">
        {tab === "body" && (
          <article className="prose prose-sm max-w-none">
            <CitedMarkdown
              source={a.body ?? ""}
              citations={sources.map((s) => ({
                url: s.url ?? "",
                title: s.title,
                org: s.publisher,
              }))}
            />
          </article>
        )}
        {tab === "history" && (
          <UnifiedTimeline
            artifactId={id}
            scopeKey={code}
            approvals={approvals as Parameters<typeof UnifiedTimeline>[0]["approvals"]}
            revisions={d.revisions}
          />
        )}
      </div>
    </div>
  );
}
