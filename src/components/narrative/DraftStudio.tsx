import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Copy, Send, Sparkles } from "lucide-react";

import {
  generateChannelDraft,
  listArtifactsForSignal,
  publishArtifact,
} from "@/lib/narrative-chamber.functions";
import { getComms } from "@/lib/narrative.functions";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { key: "press_release", label: "Press release" },
  { key: "pm_statement", label: "PM statement" },
  { key: "x_thread", label: "X thread" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "cabinet_memo", label: "Cabinet memo" },
  { key: "radio_60", label: "Radio 60s" },
  { key: "op_ed_lede", label: "Op-ed lede" },
] as const;
type ChannelKey = (typeof CHANNELS)[number]["key"];

export function DraftStudio({ signalId }: { signalId: string }) {
  const qc = useQueryClient();
  const gen = useServerFn(generateChannelDraft);
  const publish = useServerFn(publishArtifact);
  const getC = useServerFn(getComms);
  const [active, setActive] = useState<ChannelKey>("press_release");
  const [publishedUrl, setPublishedUrl] = useState("");

  const artifacts = useQuery({
    queryKey: ["narrative-artifacts", signalId],
    queryFn: () => listArtifactsForSignal({ data: { signalId } }),
  });
  const strategyId = artifacts.data?.strategies?.[0]?.id;

  const forActive = useMemo(
    () => artifacts.data?.comms?.find((c) => c.channel === active),
    [artifacts.data, active],
  );

  const commsBody = useQuery({
    queryKey: ["narrative-comms", forActive?.id],
    queryFn: () => getC({ data: { id: forActive!.id } }),
    enabled: !!forActive?.id,
  });

  const genM = useMutation({
    mutationFn: async () => {
      if (!strategyId) throw new Error("Draft the strategy first (Act 3).");
      return gen({ data: { strategyId, signalId, channel: active } });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["narrative-artifacts", signalId] });
    },
  });

  const pubM = useMutation({
    mutationFn: async () => {
      if (!forActive?.id) throw new Error("Nothing to publish.");
      return publish({ data: { id: forActive.id, publishedUrl: publishedUrl.trim() || undefined } });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["narrative-artifacts", signalId] });
    },
  });

  const body = commsBody.data?.body ?? "";
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <section id="publish" className="border border-line-200 bg-paper-0 p-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Act 4 · Publish
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">Channel drafts</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => genM.mutate()}
            disabled={genM.isPending || !strategyId}
            className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-800 disabled:opacity-50"
          >
            <Sparkles size={12} /> {genM.isPending ? "Writing…" : forActive ? "Regenerate" : "Generate"}
          </button>
        </div>
      </header>

      <nav className="mt-4 flex flex-wrap gap-1 border-b border-line-200">
        {CHANNELS.map((c) => {
          const hasDraft = artifacts.data?.comms?.some((a) => a.channel === c.key);
          const isReleased = artifacts.data?.comms?.some((a) => a.channel === c.key && a.draft_state === "released");
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-[12px] font-mono uppercase tracking-[0.14em]",
                active === c.key
                  ? "border-ink-950 text-ink-950"
                  : "border-transparent text-ink-500 hover:text-ink-950",
              )}
            >
              {c.label}
              {isReleased && <span className="ml-1 text-emerald-700">●</span>}
              {!isReleased && hasDraft && <span className="ml-1 text-amber-600">●</span>}
            </button>
          );
        })}
      </nav>

      {genM.error && <p className="mt-3 text-sm text-rose-600">{(genM.error as Error).message}</p>}

      {!strategyId && (
        <p className="mt-4 text-sm text-ink-500">Draft a strategy statement (Act 3) before generating channel copy.</p>
      )}

      {forActive ? (
        <>
          <article className="prose prose-sm mt-4 max-w-none border border-line-200 bg-paper-100/30 p-4">
            <ReactMarkdown>{body || "_empty_"}</ReactMarkdown>
          </article>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            <span>{words} words · {body.length} chars</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(body)}
              className="inline-flex items-center gap-1 hover:text-ink-950"
            >
              <Copy size={11} /> Copy
            </button>
          </div>

          <div className="mt-4 flex items-end gap-2 border-t border-line-200 pt-4">
            <label className="flex-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Published URL (optional)</span>
              <input
                type="url"
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                placeholder="https://gov.example/press/2026-…"
                className="mt-1 w-full border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => pubM.mutate()}
              disabled={pubM.isPending || forActive.draft_state === "released"}
              className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-800 disabled:opacity-50"
            >
              <Send size={12} /> {forActive.draft_state === "released" ? "Published" : pubM.isPending ? "Publishing…" : "Publish"}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-500">No draft yet — click Generate to write copy tuned for {CHANNELS.find(c => c.key === active)?.label}.</p>
      )}
    </section>
  );
}
