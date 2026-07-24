import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Image as ImageIcon, Link2, FileText, Loader2, CheckCircle2, AlertTriangle, PlayCircle, ArrowRight } from "lucide-react";

import { listOppositionItems, type OppositionItem } from "@/lib/narrative/opposition-intake.functions";
import { OppositionIntakeDropZone } from "@/components/narrative/opposition/OppositionIntakeDropZone";
import { OppositionStepper, type StepperState } from "@/components/narrative/opposition/OppositionStepper";
import { CounterCampaignPanel, type CounterCampaignStage } from "@/components/narrative/opposition/CounterCampaignPanel";

function itemsQuery(code: string) {
  return queryOptions({
    queryKey: ["opposition-items", code],
    queryFn: () => listOppositionItems({ data: { countryCode: code } }),
    refetchInterval: (q) => {
      const items = q.state.data as OppositionItem[] | undefined;
      if (!items) return false;
      return items.some((i) => i.status === "queued" || i.status === "analyzing") ? 3000 : false;
    },
  });
}

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/narrative/opposition/",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Opposition Intel · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(itemsQuery(params.code));
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-rose-600">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-ink-500">Opposition Intel not found.</div>
  ),
  component: OppositionIndex,
});

function kindIcon(kind: string) {
  if (kind === "meme" || kind === "screenshot") return <ImageIcon size={12} />;
  if (kind === "link") return <Link2 size={12} />;
  return <FileText size={12} />;
}

function OppositionIndex() {
  const { code } = Route.useParams();
  const { data: items } = useSuspenseQuery(itemsQuery(code));

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [stage, setStage] = useState<CounterCampaignStage>("idle");

  // Auto-focus the newest intake so the panel populates without a click.
  useEffect(() => {
    if (!focusedId && items.length > 0) setFocusedId(items[0].id);
  }, [items, focusedId]);

  const focusedItem = useMemo(() => items.find((i) => i.id === focusedId) ?? null, [items, focusedId]);

  const stepperState: StepperState = useMemo(() => {
    const captureDone = items.length > 0;
    return {
      capture: captureDone ? "done" : "active",
      analyze:
        stage === "analyzing"
          ? "active"
          : stage === "failed"
          ? "failed"
          : focusedItem && focusedItem.status === "analyzed"
          ? "done"
          : captureDone
          ? "active"
          : "idle",
      plan:
        stage === "drafting"
          ? "active"
          : stage === "ready" || stage === "published"
          ? "done"
          : "idle",
      publish: stage === "published" ? "done" : stage === "ready" ? "active" : "idle",
    };
  }, [items.length, focusedItem, stage]);

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Act 0 · Opposition Intel
        </p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-ink-950">
          Drop what they're saying.<br />Get a counter-campaign back.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-700">
          Capture the opposition artifact, watch the AI analyze motivation and origin,
          review an auto-drafted McKinsey-grade counter-campaign, then publish it to your
          Comms Library — all on this page.
        </p>
      </header>

      <OppositionStepper state={stepperState} />

      <OppositionIntakeDropZone
        code={code}
        onIntakeCreated={(id) => setFocusedId(id)}
      />

      <CounterCampaignPanel
        itemId={focusedId}
        code={code}
        onStageChange={setStage}
      />

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Recent intakes · {items.length}
          </h2>
          {focusedId && items.length > 1 && (
            <button
              type="button"
              onClick={() => setFocusedId(null)}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
            >
              Clear focus
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <EmptyHowItWorks />
        ) : (
          <ul className="mt-4 divide-y divide-line-200 border border-line-200">
            {items.map((it) => {
              const isFocused = it.id === focusedId;
              return (
                <li
                  key={it.id}
                  className={`flex items-center justify-between gap-3 p-4 transition ${
                    isFocused ? "bg-paper-50" : "hover:bg-paper-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedId(it.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        {kindIcon(it.kind)} {it.kind}
                      </span>
                      <span>·</span>
                      <span>{new Date(it.created_at).toLocaleString()}</span>
                      <span>·</span>
                      <StatusPill status={it.status} />
                    </div>
                    <p className="mt-1 truncate font-serif text-base text-ink-950">
                      {it.title || it.motivation_summary || it.source_url || "Untitled"}
                    </p>
                    {it.motivation_summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-700">{it.motivation_summary}</p>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {typeof it.severity === "number" && it.severity >= 4 && (
                      <AlertTriangle size={14} className="text-rose-600" />
                    )}
                    <button
                      type="button"
                      onClick={() => setFocusedId(it.id)}
                      className="btn-ghost inline-flex items-center gap-1.5 text-[11px]"
                    >
                      {isFocused ? "Focused" : "Focus"} <ArrowRight size={11} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon?: ReactElement }> = {
    queued: { label: "Queued", className: "border-line-200 text-ink-500", icon: <Loader2 size={9} className="animate-spin" /> },
    analyzing: { label: "Analyzing", className: "border-ink-950 text-ink-950", icon: <Loader2 size={9} className="animate-spin" /> },
    analyzed: { label: "Ready", className: "border-ink-950 text-ink-950", icon: <CheckCircle2 size={9} /> },
    failed: { label: "Failed", className: "border-rose-300 text-rose-700", icon: <AlertTriangle size={9} /> },
    archived: { label: "Archived", className: "border-line-200 text-ink-500" },
  };
  const cfg = map[status] ?? { label: status, className: "border-line-200 text-ink-500" };
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${cfg.className}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function EmptyHowItWorks() {
  const rows: Array<[string, string]> = [
    ["01 · Capture", "Drop a meme, screenshot, PDF, link or forwarded text."],
    ["02 · Analyze", "AI extracts motivation, origin and how it's amplifying."],
    ["03 · Counter-campaign", "A McKinsey-grade plan auto-drafts on this page."],
    ["04 · Publish", "Send the plan to your Comms Library as a draft, one click."],
  ];
  return (
    <div className="mt-4 border border-dashed border-line-200 bg-paper-0 p-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        <PlayCircle size={12} /> How this works
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {rows.map(([t, d]) => (
          <li key={t} className="border border-line-200 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{t}</p>
            <p className="mt-1 text-sm text-ink-700">{d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-ink-500">Your first drop will land here.</p>
    </div>
  );
}
