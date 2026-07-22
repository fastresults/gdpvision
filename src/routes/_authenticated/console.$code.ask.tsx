// Ask — chat with the country's Second Brain. Uses askCounsel; threads are
// persisted per country in localStorage. Auto-runs the first question when
// arriving from the Study composer via ?q=.

import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowRight, ArrowUpRight, Loader2, RefreshCcw, Sparkles } from "lucide-react";

import { askCounsel, type CounselAnswer } from "@/lib/counsel.functions";
import { VoiceMicButton } from "@/components/console/VoiceMicButton";
import { useCountryAskThread, type AskTurn } from "@/hooks/useCountryAskThread";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/console/$code/ask")({
  head: () => ({
    meta: [
      { title: "Ask the Second Brain — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AskPage,
});

function AskPage() {
  const { code } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { turns, append, clear } = useCountryAskThread(code);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const consumedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  async function send(question: string) {
    const q0 = question.trim();
    if (!q0 || busy) return;
    setBusy(true);
    setError(null);
    const startedAt = new Date().toISOString();
    try {
      const res: CounselAnswer = await askCounsel({
        data: { scopeKey: code, question: q0 },
      });
      const turn: AskTurn = {
        id: res.id,
        question: q0,
        spoken: res.spoken_block,
        written: res.written_block,
        citations: res.citations,
        createdAt: startedAt,
      };
      append(turn);
      setInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Auto-run first question when arriving with ?q=…
  useEffect(() => {
    if (!q || consumedSeedRef.current === q) return;
    consumedSeedRef.current = q;
    // Clear the search param so a page refresh doesn't re-ask.
    navigate({
      to: "/console/$code/ask",
      params: { code },
      search: {},
      replace: true,
    });
    void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function convertToSend(question: string) {
    navigate({
      to: "/console/$code/request/new",
      params: { code },
      search: { seed: question } as never,
    });
  }

  const showEmpty = turns.length === 0 && !busy;

  const canned = [
    "What's driving inflation this quarter?",
    "How is tourism tracking versus target?",
    "Which sectors are showing the strongest growth signal?",
    "Summarise our latest fiscal position in plain language.",
  ];

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
            Ask the Second Brain
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-tight text-ink-950 sm:text-4xl">
            Quick, cited answers.
          </h1>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear this conversation?")) clear();
            }}
            className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            <RefreshCcw size={12} /> New
          </button>
        )}
      </header>

      {/* Conversation */}
      <div className="mt-8 flex-1 space-y-8 pb-40">
        {showEmpty && (
          <div className="space-y-6">
            <p className="max-w-lg text-ink-500">
              Ask anything grounded in this country's Second Brain — indicators,
              ministries, sectors, recent decisions. Answers come with sources you can open.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {canned.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="card-choice group p-4 text-left"
                >
                  <p className="font-serif text-base text-ink-950">{c}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 group-hover:text-ink-950">
                    Tap to ask →
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <TurnBlock key={t.id} turn={t} onSend={convertToSend} />
        ))}

        {busy && (
          <div className="border border-line-200 bg-paper-0 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Second Brain is reading…
            </p>
            <div className="mt-2 flex items-center gap-2 text-ink-500">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Searching the corpus, drafting a cited answer.</span>
            </div>
          </div>
        )}

        {error && (
          <div className="border border-[var(--signal-caution)] bg-paper-0 p-4 text-sm text-[var(--signal-caution)]">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer pinned to bottom */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line-200 bg-paper-50/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Follow up — or ask something new"
              className="min-h-[48px] w-full resize-none border border-line-200 bg-paper-0 p-3 font-serif text-base text-ink-950 placeholder:text-ink-500/60 focus:border-ink-950 focus:outline-none"
              disabled={busy}
            />
            <div className="flex shrink-0 items-center gap-2">
              <VoiceMicButton
                onTranscript={(t) => setInput((prev) => (prev ? `${prev.trim()} ${t}` : t))}
                label=""
              />
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={busy || input.trim().length < 2}
                aria-label="Ask"
                className="btn-primary inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 px-4 text-sm uppercase tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <p className="mt-2 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 sm:block">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}

function TurnBlock({ turn, onSend }: { turn: AskTurn; onSend: (q: string) => void }) {
  return (
    <article className="space-y-3">
      {/* User */}
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-ink-950 px-4 py-3 font-serif text-base text-paper-50">
          {turn.question}
        </p>
      </div>

      {/* Assistant */}
      <div className="border border-line-200 bg-paper-0">
        <div className="border-b border-line-200 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
            Second Brain — spoken
          </p>
          <p className="mt-2 whitespace-pre-wrap font-serif text-lg leading-relaxed text-ink-950">
            {turn.spoken || "No spoken summary."}
          </p>
        </div>

        {turn.written && (
          <div className="px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Written detail
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-950">
              {turn.written}
            </p>
          </div>
        )}

        {turn.citations.length > 0 && (
          <div className="border-t border-line-200 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Sources
            </p>
            <ol className="mt-2 space-y-1 text-sm text-ink-500">
              {turn.citations.map((c, i) => (
                <li key={c.id} className="leading-snug">
                  <span className="mr-1 font-mono text-[10px] text-ink-500">[{i + 1}]</span>
                  <span className="text-ink-950">{c.title}</span>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                    {c.kind} · {c.sector_code}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-200 px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {new Date(turn.createdAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <button
            type="button"
            onClick={() => onSend(turn.question)}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:text-gold-500"
          >
            <Sparkles size={12} /> This needs more than an answer — send it to the team{" "}
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}
