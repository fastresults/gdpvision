// Ask — chat with the country's Second Brain. A round "Ask" button owns the
// primary action; each answer has a control panel (copy, expand into a
// request, remove, toggle written detail & sources). Thread controls live in
// a compact dropdown in the header.

import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  MoreHorizontal,
  Search,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
  Mic,
} from "lucide-react";

import { askCounsel, askCounselDeepResearch, type CounselAnswer } from "@/lib/counsel.functions";
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
  const { turns, append, update, clear, remove } = useCountryAskThread(code);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const consumedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  useEffect(() => {
    if (composerOpen) {
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [composerOpen]);

  async function send(question: string) {
    const q0 = question.trim();
    if (!q0 || busy) return;
    setBusy(true);
    setError(null);
    setComposerOpen(false);
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
        evidenceState: res.evidence_state,
        evidenceReason: res.evidence_reason,
        deepResearch: { status: "idle" },
      };
      append(turn);
      setInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runDeepResearch(turn: AskTurn) {
    if (turn.deepResearch?.status === "running") return;
    update(turn.id, { deepResearch: { ...(turn.deepResearch ?? { status: "idle" }), status: "running", error: undefined } });
    try {
      const res: CounselAnswer = await askCounselDeepResearch({
        data: { scopeKey: code, question: turn.question, parentAnswerId: turn.id },
      });
      update(turn.id, {
        spoken: res.spoken_block,
        written: res.written_block,
        citations: res.citations,
        evidenceState: res.evidence_state,
        evidenceReason: res.evidence_reason,
        deepResearch: {
          status: "done",
          sources: res.research_sources,
          spoken: res.spoken_block,
          written: res.written_block,
          citations: res.citations,
          ranAt: new Date().toISOString(),
        },
      });
    } catch (e) {
      update(turn.id, {
        deepResearch: {
          ...(turn.deepResearch ?? { status: "idle" }),
          status: "error",
          error: (e as Error).message,
        },
      });
    }
  }

  function skipDeepResearch(turn: AskTurn) {
    update(turn.id, {
      deepResearch: { ...(turn.deepResearch ?? { status: "idle" }), status: "skipped" },
    });
  }

  // Auto-run first question when arriving with ?q=…
  useEffect(() => {
    if (!q || consumedSeedRef.current === q) return;
    consumedSeedRef.current = q;
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
    <div className="relative flex min-h-[calc(100dvh-8rem)] flex-col pb-40 sm:pb-32">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
            Ask the Second Brain
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-tight text-ink-950 sm:text-4xl">
            Quick, cited answers.
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-500 sm:text-base">
            {turns.length === 0
              ? "Tap Ask below to begin. Every answer is grounded in this country's Second Brain."
              : `${turns.length} answer${turns.length === 1 ? "" : "s"} in this conversation.`}
          </p>
        </div>

        {/* Thread menu */}
        {turns.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Conversation menu"
              className="inline-flex h-10 w-10 items-center justify-center border border-line-200 bg-paper-0 text-ink-950 hover:border-ink-950"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-12 z-40 w-56 border border-line-200 bg-paper-0 shadow-lg"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Clear this conversation?")) clear();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 border-b border-line-200 px-3 py-3 text-left text-sm text-ink-950 hover:bg-paper-50"
                >
                  <RefreshCcw size={14} /> New conversation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = turns
                      .map(
                        (t) =>
                          `Q: ${t.question}\n\n${t.spoken}\n\n${t.written || ""}`.trim(),
                      )
                      .join("\n\n---\n\n");
                    void navigator.clipboard.writeText(text);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-ink-950 hover:bg-paper-50"
                >
                  <Copy size={14} /> Copy conversation
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="mt-8 flex-1 space-y-6">
        {showEmpty && (
          <div className="space-y-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Or start with one of these
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
          <TurnBlock
            key={t.id}
            turn={t}
            onSend={convertToSend}
            onRemove={() => remove(t.id)}
            onAskAgain={(q) => send(q)}
            onDeepResearch={() => runDeepResearch(t)}
            onSkipDeepResearch={() => skipDeepResearch(t)}
          />
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

      {/* Round Ask button (FAB) */}
      {!composerOpen && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          disabled={busy}
          aria-label="Ask a question"
          className="group fixed bottom-6 left-1/2 z-30 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full bg-ink-950 text-paper-50 shadow-2xl transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 sm:h-24 sm:w-24"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="absolute inset-0 rounded-full ring-1 ring-ink-950/20 transition-transform group-hover:scale-110" />
          <span className="absolute inset-2 rounded-full border border-paper-50/20" />
          <div className="relative flex flex-col items-center gap-0.5">
            <Sparkles size={22} className="sm:hidden" />
            <Sparkles size={26} className="hidden sm:block" />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em]">Ask</span>
          </div>
        </button>
      )}

      {/* Composer sheet */}
      {composerOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setComposerOpen(false)}
            className="fixed inset-0 z-30 bg-ink-950/30 backdrop-blur-sm"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line-200 bg-paper-0 shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto max-w-3xl px-4 pb-4 pt-4 sm:px-6 sm:pt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
                  Ask the Second Brain
                </p>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  aria-label="Close composer"
                  className="inline-flex h-9 w-9 items-center justify-center text-ink-500 hover:text-ink-950"
                >
                  <X size={16} />
                </button>
              </div>
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={3}
                placeholder="Ask anything — an indicator, ministry, sector, or recent decision."
                className="min-h-[6rem] w-full resize-none border border-line-200 bg-paper-50 p-3 font-serif text-base leading-relaxed text-ink-950 placeholder:text-ink-500/60 focus:border-ink-950 focus:outline-none sm:min-h-[8rem] sm:p-4 sm:text-lg"
                disabled={busy}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <VoiceMicButton
                  onTranscript={(t) => setInput((prev) => (prev ? `${prev.trim()} ${t}` : t))}
                  label="Speak"
                />
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={busy || input.trim().length < 2}
                  className="btn-primary inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 px-6 text-sm uppercase tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                  Ask now
                </button>
              </div>
              <p className="mt-3 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 sm:block">
                Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TurnBlock({
  turn,
  onSend,
  onRemove,
  onAskAgain,
  onDeepResearch,
  onSkipDeepResearch,
}: {
  turn: AskTurn;
  onSend: (q: string) => void;
  onRemove: () => void;
  onAskAgain: (q: string) => void;
  onDeepResearch: () => void;
  onSkipDeepResearch: () => void;
}) {
  const [showWritten, setShowWritten] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyAnswer() {
    const parts = [turn.spoken];
    if (turn.written) parts.push("\n" + turn.written);
    if (turn.citations.length) {
      parts.push(
        "\nSources:\n" +
          turn.citations
            .map((c, i) => `[${i + 1}] ${c.title} — ${c.kind} · ${c.sector_code}`)
            .join("\n"),
      );
    }
    void navigator.clipboard.writeText(parts.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

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
        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Second Brain
            </p>
            {turn.deepResearch?.status === "done" && turn.deepResearch.ranAt && (
              <span className="inline-flex items-center gap-1 border border-line-200 bg-paper-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                <Sparkles size={10} /> Deep research
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap font-serif text-base leading-relaxed text-ink-950 sm:text-lg">
            {turn.spoken || "No spoken summary."}
          </p>
        </div>

        {/* Insufficient evidence CTA */}
        {turn.evidenceState === "insufficient" &&
          turn.deepResearch?.status !== "done" &&
          turn.deepResearch?.status !== "skipped" && (
            <InsufficientEvidencePanel
              reason={turn.evidenceReason}
              status={turn.deepResearch?.status ?? "idle"}
              error={turn.deepResearch?.error}
              onRun={onDeepResearch}
              onSkip={onSkipDeepResearch}
            />
          )}

        {turn.written && showWritten && (
          <div className="border-t border-line-200 bg-paper-50 px-4 py-4 sm:px-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Written detail
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-950">
              {turn.written}
            </p>
          </div>
        )}

        {showSources && (turn.citations.length > 0 || (turn.deepResearch?.sources?.length ?? 0) > 0) && (
          <div className="border-t border-line-200 px-4 py-4 sm:px-5 space-y-4">
            {turn.citations.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                  Second Brain
                </p>
                <ol className="mt-2 space-y-1.5 text-sm text-ink-500">
                  {turn.citations.map((c, i) => (
                    <li key={c.id} className="leading-snug">
                      <span className="mr-1 font-mono text-[10px] text-ink-500">[C{i + 1}]</span>
                      <span className="text-ink-950">{c.title}</span>
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                        {c.kind} · {c.sector_code}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {(turn.deepResearch?.sources?.length ?? 0) > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                  Open-web research
                </p>
                <ol className="mt-2 space-y-1.5 text-sm text-ink-500">
                  {turn.deepResearch!.sources!.map((s, i) => (
                    <li key={`${s.url}-${i}`} className="leading-snug">
                      <span className="mr-1 font-mono text-[10px] text-ink-500">[R{i + 1}]</span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-ink-950 underline decoration-line-200 hover:decoration-ink-950"
                      >
                        {s.title}
                      </a>
                      {s.publisher && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                          {s.publisher}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Control panel */}
        <div className="flex flex-wrap items-center gap-1 border-t border-line-200 bg-paper-50 px-2 py-2">
          {turn.written && (
            <ToolbarButton
              onClick={() => setShowWritten((v) => !v)}
              active={showWritten}
              icon={showWritten ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              label={showWritten ? "Hide detail" : "Read more"}
            />
          )}
          {(turn.citations.length > 0 || (turn.deepResearch?.sources?.length ?? 0) > 0) && (
            <ToolbarButton
              onClick={() => setShowSources((v) => !v)}
              active={showSources}
              label={`Sources · ${turn.citations.length + (turn.deepResearch?.sources?.length ?? 0)}`}
            />
          )}
          <ToolbarButton
            onClick={copyAnswer}
            icon={<Copy size={12} />}
            label={copied ? "Copied" : "Copy"}
          />
          <ToolbarButton
            onClick={() => onAskAgain(turn.question)}
            icon={<RefreshCcw size={12} />}
            label="Ask again"
          />
          <div className="ml-auto flex items-center gap-1">
            <ToolbarButton
              onClick={() => onSend(turn.question)}
              icon={<ArrowUpRight size={12} />}
              label="Send to team"
              accent
            />
            <ToolbarButton
              onClick={onRemove}
              icon={<Trash2 size={12} />}
              aria-label="Remove answer"
            />
          </div>
        </div>

        <div className="px-4 py-2 sm:px-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {new Date(turn.createdAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </article>
  );
}

function ToolbarButton({
  onClick,
  label,
  icon,
  active,
  accent,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  accent?: boolean;
  "aria-label"?: string;
}) {
  const base =
    "inline-flex min-h-[36px] items-center gap-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors";
  const tone = accent
    ? "text-ink-950 hover:bg-ink-950 hover:text-paper-0"
    : active
      ? "bg-ink-950 text-paper-0"
      : "text-ink-500 hover:bg-paper-0 hover:text-ink-950";
  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`} aria-label={ariaLabel}>
      {icon}
      {label}
    </button>
  );
}

function InsufficientEvidencePanel({
  reason,
  status,
  error,
  onRun,
  onSkip,
}: {
  reason?: string;
  status: "idle" | "running" | "done" | "error" | "skipped";
  error?: string;
  onRun: () => void;
  onSkip: () => void;
}) {
  const running = status === "running";
  return (
    <div className="border-t border-line-200 bg-paper-50 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
            Evidence gap
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-950">
            {reason ?? "The Second Brain doesn't have enough evidence to answer this confidently."}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Run deep research to search the open web, capture sources into the Second Brain, and regenerate a grounded answer.
          </p>
          {status === "error" && error && (
            <p className="mt-2 text-xs text-signal-red">Research failed: {error}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="btn-primary inline-flex min-h-[40px] items-center gap-2 px-4 text-[11px] font-mono uppercase tracking-[0.18em] disabled:opacity-60"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {running ? "Researching…" : status === "error" ? "Retry deep research" : "Run deep research"}
          </button>
          {!running && (
            <button
              type="button"
              onClick={onSkip}
              className="btn-ghost inline-flex min-h-[40px] items-center px-3 text-[11px] font-mono uppercase tracking-[0.18em]"
            >
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
