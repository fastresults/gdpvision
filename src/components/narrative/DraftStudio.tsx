import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Copy, Send, Sparkles, Square } from "lucide-react";

import {
  generateChannelDraft,
  generateStrategyDraft,
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

type Progress = {
  done: number;
  total: number;
  current: ChannelKey | null;
  errors: { channel: ChannelKey; msg: string }[];
};

export function DraftStudio({ signalId }: { signalId: string }) {
  const qc = useQueryClient();
  const gen = useServerFn(generateChannelDraft);
  const draftStrategy = useServerFn(generateStrategyDraft);
  const publish = useServerFn(publishArtifact);
  const getC = useServerFn(getComms);
  const [active, setActive] = useState<ChannelKey>("press_release");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [selected, setSelected] = useState<Set<ChannelKey>>(new Set());
  const [progress, setProgress] = useState<Progress | null>(null);
  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const selectionInitialized = useRef(false);

  const storageKey = `draftstudio:channels:${signalId}`;

  const artifacts = useQuery({
    queryKey: ["narrative-artifacts", signalId],
    queryFn: () => listArtifactsForSignal({ data: { signalId } }),
  });
  const strategyId = artifacts.data?.strategies?.[0]?.id;

  // Initialize selection: from localStorage, else channels with existing drafts,
  // else all channels.
  useEffect(() => {
    if (selectionInitialized.current || !artifacts.data) return;
    selectionInitialized.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw) as ChannelKey[];
        if (Array.isArray(arr) && arr.length) {
          setSelected(new Set(arr.filter((k) => CHANNELS.some((c) => c.key === k))));
          return;
        }
      }
    } catch { /* ignore */ }
    const withDrafts = new Set<ChannelKey>(
      (artifacts.data.comms ?? []).map((c) => c.channel as ChannelKey),
    );
    setSelected(withDrafts.size ? withDrafts : new Set(CHANNELS.map((c) => c.key)));
  }, [artifacts.data, storageKey]);

  useEffect(() => {
    if (!selectionInitialized.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...selected]));
    } catch { /* ignore */ }
  }, [selected, storageKey]);

  const forActive = useMemo(
    () => artifacts.data?.comms?.find((c) => c.channel === active),
    [artifacts.data, active],
  );

  const commsBody = useQuery({
    queryKey: ["narrative-comms", forActive?.id],
    queryFn: () => getC({ data: { id: forActive!.id } }),
    enabled: !!forActive?.id,
  });

  const runBatch = useMutation({
    mutationFn: async (channels: ChannelKey[]) => {
      if (!channels.length) throw new Error("Select at least one channel.");
      let sid = strategyId;
      if (!sid) {
        setProgress({ done: 0, total: channels.length, current: null, errors: [] });
        const s = await draftStrategy({ data: { signalId } });
        sid = s?.id as string | undefined;
        await qc.invalidateQueries({ queryKey: ["narrative-artifacts", signalId] });
        if (!sid) throw new Error("Could not draft strategy automatically.");
      }
      abortRef.current = { cancelled: false };
      const errors: Progress["errors"] = [];
      setProgress({ done: 0, total: channels.length, current: channels[0], errors: [] });
      let firstGenerated: ChannelKey | null = null;
      for (let i = 0; i < channels.length; i++) {
        if (abortRef.current.cancelled) break;
        const ch = channels[i];
        setProgress((p) => (p ? { ...p, current: ch } : p));
        try {
          await gen({ data: { strategyId: sid, signalId, channel: ch } });
          if (!firstGenerated) firstGenerated = ch;
          await qc.invalidateQueries({ queryKey: ["narrative-artifacts", signalId] });
        } catch (e) {
          errors.push({ channel: ch, msg: (e as Error).message });
        }
        setProgress((p) => (p ? { ...p, done: i + 1, errors: [...errors] } : p));
      }
      return { firstGenerated, errors };
    },
    onSuccess: (res) => {
      if (res.firstGenerated) setActive(res.firstGenerated);
    },
    onSettled: () => {
      // Keep progress visible briefly so user can read final state / errors.
      setTimeout(() => setProgress(null), 4000);
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

  function toggle(ch: ChannelKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch); else next.add(ch);
      return next;
    });
  }
  const allSelected = selected.size === CHANNELS.length;
  const running = runBatch.isPending;
  const selectedList = CHANNELS.map((c) => c.key).filter((k) => selected.has(k));
  const generateLabel = running
    ? `Writing ${progress?.done ?? 0}/${progress?.total ?? selectedList.length}…`
    : selectedList.length === 0
      ? "Generate"
      : `Generate (${selectedList.length})`;

  return (
    <section id="publish" className="border border-line-200 bg-paper-0 p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Act 4 · Publish
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">Channel drafts</h2>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <button
              onClick={() => { abortRef.current.cancelled = true; }}
              className="inline-flex items-center gap-2 border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:border-ink-950"
            >
              <Square size={12} /> Stop
            </button>
          )}
          <button
            onClick={() => runBatch.mutate(selectedList)}
            disabled={running || selectedList.length === 0}
            className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-800 disabled:opacity-50"
          >
            <Sparkles size={12} /> {generateLabel}
          </button>
        </div>
      </header>

      {/* Channel selector */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-200 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Channels
        </span>
        {CHANNELS.map((c) => {
          const on = selected.has(c.key);
          const hasDraft = artifacts.data?.comms?.some((a) => a.channel === c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              disabled={running}
              className={cn(
                "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition",
                on
                  ? "border-ink-950 bg-ink-950 text-paper-0"
                  : "border-line-200 text-ink-500 hover:border-ink-950 hover:text-ink-950",
                running && "opacity-60",
              )}
            >
              <span aria-hidden>{on ? "☑" : "☐"}</span>
              {c.label}
              {hasDraft && <span className={cn("ml-0.5", on ? "text-emerald-300" : "text-emerald-600")}>●</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <button
            type="button"
            disabled={running}
            onClick={() => setSelected(allSelected ? new Set() : new Set(CHANNELS.map((c) => c.key)))}
            className="hover:text-ink-950 disabled:opacity-50"
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="mt-3 border border-line-200 bg-paper-100/40 p-3">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            <span>
              {running
                ? `Writing ${progress.done + (progress.current ? 1 : 0)} / ${progress.total} · ${CHANNELS.find((c) => c.key === progress.current)?.label ?? ""}`
                : `Done · ${progress.done} / ${progress.total}`}
            </span>
            <span>{progress.errors.length ? `${progress.errors.length} failed` : "no errors"}</span>
          </div>
          <div className="mt-2 h-1 w-full bg-line-200">
            <div
              className="h-full bg-ink-950 transition-all"
              style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
          {progress.errors.length > 0 && (
            <ul className="mt-2 space-y-1 font-mono text-[10px] text-rose-600">
              {progress.errors.map((e) => (
                <li key={e.channel}>
                  {CHANNELS.find((c) => c.key === e.channel)?.label}: {e.msg}
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => runBatch.mutate(progress.errors.map((e) => e.channel))}
                  className="uppercase tracking-[0.18em] text-ink-950 underline"
                >
                  Retry failed
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

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

      {runBatch.error && <p className="mt-3 text-sm text-rose-600">{(runBatch.error as Error).message}</p>}

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
        <p className="mt-4 text-sm text-ink-500">No draft yet — pick channels above and click Generate.</p>
      )}
    </section>
  );
}
