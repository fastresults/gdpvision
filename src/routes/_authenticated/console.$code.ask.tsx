// Ask — chat with the country's Second Brain. A round "Ask" button owns the
// primary action; each answer has a control panel (copy, expand into a
// request, remove, toggle written detail & sources). Thread controls live in
// a compact dropdown in the header.

import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowUpRight,
  BookOpen,
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
  FileText,
  ExternalLink,
} from "lucide-react";

import {
  askCounsel,
  askCounselDeepResearch,
  expoundCounsel,
  type CounselAnswer,
} from "@/lib/counsel.functions";
import { VoiceMicButton } from "@/components/console/VoiceMicButton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
      // Auto-trigger deep research when the Second Brain lacks evidence.
      if (res.evidence_state === "insufficient") {
        void runDeepResearch(turn);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runDeepResearch(turn: AskTurn) {
    if (turn.deepResearch?.status === "running") return;
    const nextDeepResearch = { ...(turn.deepResearch ?? { status: "idle" as const }), status: "running" as const, error: undefined };
    update(turn.id, { deepResearch: nextDeepResearch });
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
          ...nextDeepResearch,
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

  async function runExpound(turn: AskTurn) {
    if (turn.expound?.status === "running") return;
    update(turn.id, {
      expound: { ...(turn.expound ?? { status: "idle" }), status: "running", error: undefined },
    });
    try {
      const res = await expoundCounsel({
        data: { scopeKey: code, parentAnswerId: turn.id },
      });
      update(turn.id, {
        expound: { status: "done", memo: res.memo, ranAt: res.created_at },
      });
    } catch (e) {
      update(turn.id, {
        expound: {
          ...(turn.expound ?? { status: "idle" }),
          status: "error",
          error: (e as Error).message,
        },
      });
    }
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
            onExpound={() => runExpound(t)}
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

      {/* Persistent bottom input bar (mobile-first) */}
      {!composerOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line-200 bg-paper-0/95 backdrop-blur-md"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              disabled={busy}
              aria-label="Ask a question"
              className="flex flex-1 items-center gap-3 rounded-full border border-line-200 bg-paper-50 px-4 py-3 text-left text-ink-500 shadow-sm transition-colors hover:border-ink-950 hover:text-ink-950 disabled:opacity-60"
            >
              <Sparkles size={16} className="shrink-0 text-ink-950" />
              <span className="truncate font-serif text-[15px]">
                Ask anything — indicator, ministry, sector…
              </span>
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              disabled={busy}
              aria-label="Open composer"
              className="btn-primary inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0"
            >
              <Mic size={18} />
            </button>
          </div>
        </div>
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
  onExpound,
}: {
  turn: AskTurn;
  onSend: (q: string) => void;
  onRemove: () => void;
  onAskAgain: (q: string) => void;
  onDeepResearch: () => void;
  onSkipDeepResearch: () => void;
  onExpound: () => void;
}) {
  const [showWritten, setShowWritten] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-expand the memo the first time expound completes.
  useEffect(() => {
    if (turn.expound?.status === "done" && turn.expound.memo) setShowMemo(true);
  }, [turn.expound?.status, turn.expound?.memo]);

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

        {/* Expound memo panel */}
        {turn.expound?.status === "done" && turn.expound.memo && showMemo && (
          <div className="border-t border-line-200 bg-paper-50 px-4 py-5 sm:px-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                Expound memo
              </p>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                {turn.expound.ranAt
                  ? new Date(turn.expound.ranAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
            </div>
            <div className="prose prose-sm mt-3 max-w-none whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-ink-950">
              {turn.expound.memo}
            </div>
          </div>
        )}

        {turn.expound?.status === "error" && (
          <div className="border-t border-line-200 bg-paper-50 px-4 py-3 sm:px-5">
            <p className="text-xs text-signal-red">
              Expound failed: {turn.expound.error}
            </p>
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
              onClick={() => setSourcesOpen(true)}
              icon={<BookOpen size={12} />}
              label={`Sources · ${turn.citations.length + (turn.deepResearch?.sources?.length ?? 0)}`}
            />
          )}
          {turn.expound?.status === "done" ? (
            <ToolbarButton
              onClick={() => setShowMemo((v) => !v)}
              active={showMemo}
              icon={<FileText size={12} />}
              label={showMemo ? "Hide memo" : "Show memo"}
            />
          ) : (
            <ToolbarButton
              onClick={onExpound}
              icon={
                turn.expound?.status === "running" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )
              }
              label={
                turn.expound?.status === "running"
                  ? "Expounding…"
                  : turn.expound?.status === "error"
                    ? "Retry expound"
                    : "Expound"
              }
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
      <SourcesDrawer
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        turn={turn}
      />
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
            Deep research starts automatically: open web search, source capture into the Second Brain, then a regenerated grounded answer.
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
            {running ? "Researching…" : status === "error" ? "Retry deep research" : "Run deep research now"}
          </button>
          {!running && status === "error" && (
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

function SourcesDrawer({
  open,
  onOpenChange,
  turn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turn: AskTurn;
}) {
  const corpus = turn.citations;
  const research = turn.deepResearch?.sources ?? [];
  const total = corpus.length + research.length;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md bg-paper-0 border-l border-line-200 p-0 flex flex-col"
      >
        <SheetHeader className="border-b border-line-200 px-5 py-4 space-y-1 text-left">
          <SheetTitle className="font-serif text-lg text-ink-950">Sources</SheetTitle>
          <SheetDescription className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {total} reference{total === 1 ? "" : "s"} for this answer
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              Question
            </p>
            <p className="mt-2 whitespace-pre-wrap font-serif text-sm text-ink-950">
              {turn.question}
            </p>
          </section>

          {corpus.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                  Second Brain
                </p>
                <span className="font-mono text-[10px] text-ink-500">{corpus.length}</span>
              </div>
              <ol className="mt-3 space-y-3">
                {corpus.map((c, i) => (
                  <li
                    key={c.id}
                    className="border border-line-200 bg-paper-50 px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-[10px] text-ink-500">
                        [C{i + 1}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-sm leading-snug text-ink-950">
                          {c.title}
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                          {c.kind} · {c.sector_code} · w{c.weight}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {research.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                  Open-web research
                </p>
                <span className="font-mono text-[10px] text-ink-500">{research.length}</span>
              </div>
              <ol className="mt-3 space-y-3">
                {research.map((s, i) => (
                  <li
                    key={`${s.url}-${i}`}
                    className="border border-line-200 bg-paper-50 px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-[10px] text-ink-500">
                        [R{i + 1}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="group inline-flex items-baseline gap-1.5 font-serif text-sm leading-snug text-ink-950 underline decoration-line-200 decoration-1 underline-offset-2 hover:decoration-ink-950"
                        >
                          <span className="min-w-0 break-words">{s.title}</span>
                          <ExternalLink
                            size={11}
                            className="shrink-0 translate-y-[1px] text-ink-500 group-hover:text-ink-950"
                          />
                        </a>
                        {s.publisher && (
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                            {s.publisher}
                          </p>
                        )}
                        <p className="mt-1 break-all font-mono text-[10px] text-ink-500">
                          {s.url}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {total === 0 && (
            <p className="font-serif text-sm text-ink-500">
              No sources are attached to this answer yet. Run deep research to add open-web references.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
