// Ask-the-Ledger: mobile-first, McKinsey-grade Q&A grounded in the Second Brain.
// Voice input (mic), clear conversation, copy answers, regenerate, pin to snapshots.

import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, Send, Trash2, Copy, RefreshCw, Pin, X, MessageSquare } from "lucide-react";

import {
  askTheLedger,
  pinFigureSnapshot,
  transcribeAudio,
  type LedgerAnswer,
  type FigureCitation,
  type LedgerArtifactKind,
} from "@/lib/ledger.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AskProgress } from "./AskProgress";
import { ExpandActions } from "./ExpandActions";
import { ArtifactPanel } from "./ArtifactPanel";

type Turn = {
  id: string;
  question: string;
  answer: LedgerAnswer | null;
  error?: string;
  pinnedAt?: string;
  copied?: boolean;
  artifacts?: LedgerArtifactKind[];
};

const SUGGESTIONS = [
  "What is the largest sector by GDP share?",
  "Summarize the current fiscal position.",
  "Which sectors have the highest export concentration?",
  "What is the most recent unemployment figure?",
];

export function AskTheLedger({
  countryCode,
  countryName,
  sectorCode,
}: {
  countryCode: string;
  countryName: string;
  sectorCode?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!isMobile);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const askFn = useServerFn(askTheLedger);
  const pinFn = useServerFn(pinFigureSnapshot);
  const transcribeFn = useServerFn(transcribeAudio);
  const recorder = useVoiceRecorder();

  const ask = useMutation({
    mutationFn: (payload: { id: string; question: string }) =>
      askFn({ data: { countryCode, question: payload.question, sectorCode } }).then((res) => ({
        id: payload.id,
        res,
      })),
    onSuccess: ({ id, res }) => {
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, answer: res, error: undefined } : t)));
    },
    onError: (err, vars) => {
      setTurns((prev) =>
        prev.map((t) => (t.id === vars.id ? { ...t, error: (err as Error).message } : t)),
      );
    },
  });

  const transcribe = useMutation({
    mutationFn: (clip: { base64: string; mime: string }) =>
      transcribeFn({ data: { base64: clip.base64, mime: clip.mime } }),
    onSuccess: ({ text }) => {
      if (text) setInput((prev) => (prev ? prev + " " + text : text));
    },
  });

  const pin = useMutation({
    mutationFn: (t: Turn) =>
      pinFn({
        data: {
          countryCode,
          figureKind: "composition_total",
          figureRef: { question: t.question, sector_code: sectorCode ?? null },
          label: t.question.slice(0, 200),
          scope: "personal",
          note: `Ask-the-Ledger · ${countryName}`,
          aiExplanation: t.answer?.answer ?? null,
          citations: (t.answer?.citations ?? []) as unknown as Record<string, unknown>[],
        },
      }).then(() => t.id),
    onSuccess: (id) => {
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, pinnedAt: new Date().toISOString() } : t)),
      );
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, ask.isPending]);

  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile]);

  function submit(q: string) {
    const question = q.trim();
    if (!question || ask.isPending) return;
    const id = `t_${Date.now()}`;
    setTurns((prev) => [...prev, { id, question, answer: null }]);
    setInput("");
    ask.mutate({ id, question });
  }

  function regenerate(t: Turn) {
    const id = `t_${Date.now()}`;
    setTurns((prev) => [...prev, { id, question: t.question, answer: null }]);
    ask.mutate({ id, question: t.question });
  }

  function clearAll() {
    if (turns.length === 0) return;
    if (typeof window !== "undefined" && !window.confirm("Clear the conversation?")) return;
    setTurns([]);
  }

  async function toggleMic() {
    if (recorder.state === "recording") {
      const clip = await recorder.stop();
      if (clip) transcribe.mutate({ base64: clip.base64, mime: clip.mime });
    } else {
      await recorder.start();
    }
  }

  async function copyAnswer(t: Turn) {
    if (!t.answer?.answer) return;
    const s = t.answer.structured;
    const parts: string[] = [];
    if (s) {
      parts.push(s.direct_answer);
      if (s.key_evidence.length) parts.push("\nEvidence:\n" + s.key_evidence.map((e) => `• ${e}`).join("\n"));
      if (s.caveats.length) parts.push("\nCaveats:\n" + s.caveats.map((c) => `• ${c}`).join("\n"));
    } else {
      parts.push(t.answer.answer);
    }
    if (t.answer.citations.length) {
      parts.push(
        "\nSources:\n" +
          t.answer.citations
            .map((c) => `[${c.n}] ${c.title}${c.url ? ` — ${c.url}` : ""}${c.org ? ` (${c.org})` : ""}`)
            .join("\n"),
      );
    }
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      setTurns((prev) => prev.map((x) => (x.id === t.id ? { ...x, copied: true } : x)));
      setTimeout(() => {
        setTurns((prev) => prev.map((x) => (x.id === t.id ? { ...x, copied: false } : x)));
      }, 1600);
    } catch {
      // clipboard blocked; silent
    }
  }

  const panel = (
    <div className="flex h-full w-full flex-col bg-paper-0">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-line-200 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Second Brain · {countryName}
            {sectorCode && <span className="ml-2 text-ink-500/70">· {sectorCode}</span>}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-ink-950">Ask the Ledger</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            onClick={clearAll}
            disabled={turns.length === 0}
            label="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={() => setOpen(false)} label="Close">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {/* Body */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-ink-500">
              Corpus first, whole-country context second, live web research third.
              Answers cite [N] sources and flag confidence when evidence is thin.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-none border border-line-200 bg-paper-0 px-3 py-2 text-left text-xs text-ink-700 hover:border-ink-950 hover:text-ink-950"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => {
          const isLast = i === turns.length - 1;
          return (
            <TurnBlock
              key={t.id}
              turn={t}
              countryCode={countryCode}
              countryName={countryName}
              loading={isLast && ask.isPending}
              onCancel={isLast && ask.isPending ? () => ask.reset() : undefined}
              onPin={() => pin.mutate(t)}
              pinPending={pin.isPending}
              onCopy={() => copyAnswer(t)}
              onRegenerate={() => regenerate(t)}
              onToggleArtifact={(kind) => {
                setTurns((prev) =>
                  prev.map((x) => {
                    if (x.id !== t.id) return x;
                    const cur = new Set(x.artifacts ?? []);
                    if (cur.has(kind)) cur.delete(kind);
                    else cur.add(kind);
                    return { ...x, artifacts: [...cur] };
                  }),
                );
              }}
            />
          );
        })}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t border-line-200 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {recorder.state === "recording" && (
          <div className="mb-2 flex items-center gap-2 border border-red-200 bg-red-50 px-2 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            <div className="h-1.5 flex-1 overflow-hidden bg-red-100">
              <div
                className="h-full bg-red-500 transition-[width]"
                style={{ width: `${Math.round(recorder.level * 100)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => recorder.cancel()}
              className="font-mono text-[10px] uppercase tracking-widest text-red-700 hover:text-red-900"
            >
              Cancel
            </button>
          </div>
        )}
        {recorder.error && (
          <p className="mb-2 text-[11px] text-red-700">{recorder.error}</p>
        )}
        {transcribe.isPending && (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Transcribing…
          </p>
        )}
        <div className="flex items-end gap-2">
          <IconButton
            onClick={toggleMic}
            disabled={ask.isPending || transcribe.isPending}
            label={recorder.state === "recording" ? "Stop recording" : "Record voice"}
            variant={recorder.state === "recording" ? "danger" : "default"}
          >
            {recorder.state === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </IconButton>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={isMobile ? 2 : 2}
            placeholder="Ask about a figure, sector, or trend…"
            className="min-h-[3rem] flex-1 resize-none border border-line-200 bg-paper-0 px-3 py-2 text-base text-ink-950 placeholder:text-ink-500 focus:border-ink-950 focus:outline-none md:text-sm"
          />
          <button
            type="submit"
            disabled={ask.isPending || !input.trim()}
            className="flex h-11 min-w-[44px] items-center justify-center border border-ink-950 bg-ink-950 px-3 text-paper-0 hover:opacity-90 disabled:opacity-40"
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );

  // Mobile: floating button + bottom sheet
  if (isMobile) {
    return (
      <>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-4 right-4 z-40 flex h-14 items-center gap-2 rounded-full border border-ink-950 bg-ink-950 px-5 text-paper-0 shadow-2xl"
            aria-label="Open Ask the Ledger"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-sm font-medium">Ask the Ledger</span>
          </button>
        )}
        {open && (
          <div className="fixed inset-0 z-50 flex flex-col bg-paper-0" role="dialog" aria-modal="true">
            {panel}
          </div>
        )}
      </>
    );
  }

  // Desktop: right rail
  return (
    <aside
      className={`fixed right-0 top-1/2 z-40 -translate-y-1/2 transition-transform ${
        open ? "translate-x-0" : "translate-x-[calc(100%-2.5rem)]"
      }`}
    >
      <div className="flex items-stretch">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-10 flex-col items-center justify-center gap-2 border border-line-200 bg-paper-0 py-4 text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          aria-label={open ? "Collapse Ask-the-Ledger" : "Expand Ask-the-Ledger"}
        >
          <span aria-hidden>{open ? "›" : "‹"}</span>
          <span className="[writing-mode:vertical-rl] rotate-180">Ask the Ledger</span>
        </button>
        <div className="flex h-[75vh] w-[26rem] border border-l-0 border-line-200 shadow-2xl">
          {panel}
        </div>
      </div>
    </aside>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
  variant?: "default" | "danger";
}) {
  const cls =
    variant === "danger"
      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
      : "border-line-200 bg-paper-0 text-ink-700 hover:border-ink-950 hover:text-ink-950";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-11 min-w-[44px] items-center justify-center border ${cls} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function TurnBlock({
  turn,
  countryCode,
  countryName,
  loading,
  onCancel,
  onPin,
  pinPending,
  onCopy,
  onRegenerate,
  onToggleArtifact,
}: {
  turn: Turn;
  countryCode: string;
  countryName: string;
  loading: boolean;
  onCancel?: () => void;
  onPin: () => void;
  pinPending: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onToggleArtifact: (kind: LedgerArtifactKind) => void;
}) {
  const s = turn.answer?.structured ?? null;
  const activeArtifacts = new Set<LedgerArtifactKind>(turn.artifacts ?? []);
  const sourceAnswerText = turn.answer
    ? s
      ? [
          s.situation,
          s.direct_answer,
          s.key_evidence.length ? "Evidence:\n" + s.key_evidence.map((e) => `• ${e}`).join("\n") : "",
          s.so_what?.length ? "So What:\n" + s.so_what.map((e) => `• ${e}`).join("\n") : "",
          s.caveats.length ? "Caveats:\n" + s.caveats.map((c) => `• ${c}`).join("\n") : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : (turn.answer.answer ?? "")
    : "";
  const canExpand = !!turn.answer?.grounded && !!turn.answer?.answer;

  return (
    <div className="border-l-2 border-line-200 pl-3">
      <p className="text-sm font-medium text-ink-950">{turn.question}</p>

      {loading && !turn.answer && (
        <div className="mt-3">
          <AskProgress question={turn.question} onCancel={onCancel} finalized={null} />
        </div>
      )}

      {turn.error && <p className="mt-2 text-xs text-red-700">{turn.error}</p>}

      {turn.answer && (
        <>
          {(turn.answer.extended_with_research || (turn.answer.sources_used?.web ?? 0) > 0) && (
            <div className="mt-2 inline-flex items-center gap-1 border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-indigo-800">
              Extended with live web research
            </div>
          )}
          {s ? (
            <div className="mt-2 space-y-3">
              {s.situation && (
                <p className="text-[13px] italic text-ink-700">
                  {renderCitations(s.situation, turn.answer.citations)}
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm text-ink-950">
                {renderCitations(s.direct_answer, turn.answer.citations)}
              </p>
              {s.key_evidence.length > 0 && (
                <ul className="space-y-1.5 text-[13px] text-ink-700">
                  {s.key_evidence.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-500" aria-hidden />
                      <span>{renderCitations(e, turn.answer!.citations)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.so_what && s.so_what.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-ink-500">So What</p>
                  <ul className="mt-1 space-y-1 text-[13px] text-ink-700">
                    {s.so_what.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-950" aria-hidden />
                        <span>{renderCitations(e, turn.answer!.citations)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.caveats.length > 0 && (
                <div className="border-l-2 border-amber-300 bg-amber-50/40 px-2 py-1.5">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-amber-800">Caveats</p>
                  <ul className="mt-1 space-y-0.5 text-[12px] text-amber-900">
                    {s.caveats.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <ConfidenceChip level={s.confidence} />
                <SourcesUsedChip sources={turn.answer.sources_used} />
              </div>
            </div>
          ) : turn.answer.grounded && turn.answer.answer ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">
              {renderCitations(turn.answer.answer, turn.answer.citations)}
            </p>
          ) : (
            <p className="mt-2 text-xs italic text-amber-800">
              {turn.answer.refusal_reason ?? "No grounded evidence."}
            </p>
          )}

          {turn.answer.citations.length > 0 && (
            <ul className="mt-3 space-y-1">
              {turn.answer.citations.map((c) => (
                <li key={c.n}>
                  <CitationRow cite={c} />
                </li>
              ))}
            </ul>
          )}


          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {turn.answer.answer && (
              <button onClick={onCopy} className="inline-flex items-center gap-1 hover:text-ink-950">
                <Copy className="h-3 w-3" />
                {turn.copied ? "Copied" : "Copy"}
              </button>
            )}
            <button onClick={onRegenerate} className="inline-flex items-center gap-1 hover:text-ink-950">
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </button>
            {turn.answer.grounded && (
              <button
                onClick={onPin}
                disabled={pinPending || !!turn.pinnedAt}
                className="inline-flex items-center gap-1 hover:text-ink-950 disabled:opacity-60"
              >
                <Pin className="h-3 w-3" />
                {turn.pinnedAt ? "Pinned" : pinPending ? "Pinning…" : "Pin"}
              </button>
            )}
          </div>

          {canExpand && (
            <>
              <ExpandActions onPick={onToggleArtifact} activeKinds={activeArtifacts} />
              {[...activeArtifacts].map((kind) => (
                <ArtifactPanel
                  key={kind}
                  countryCode={countryCode}
                  countryName={countryName}
                  artifact={kind}
                  sourceQuestion={turn.question}
                  sourceAnswer={sourceAnswerText}
                  citations={turn.answer!.citations}
                  onClose={() => onToggleArtifact(kind)}
                  renderCitations={renderCitations}
                  CitationRow={CitationRow}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high: "border-emerald-300 bg-emerald-50 text-emerald-800",
    medium: "border-amber-300 bg-amber-50 text-amber-800",
    low: "border-red-300 bg-red-50 text-red-800",
  }[level];
  return (
    <span className={`inline-block border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${styles}`}>
      Confidence · {level}
    </span>
  );
}

function SourcesUsedChip({ sources }: { sources?: { corpus: number; country_context: number; web: number } }) {
  if (!sources) return null;
  const parts: string[] = [];
  if (sources.corpus) parts.push(`Corpus · ${sources.corpus}`);
  if (sources.country_context) parts.push(`Country · ${sources.country_context}`);
  if (sources.web) parts.push(`Web · ${sources.web}`);
  if (parts.length === 0) return null;
  return (
    <span className="inline-block border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-500">
      {parts.join(" · ")}
    </span>
  );
}

function renderCitations(text: string, citations: FigureCitation[]) {
  const parts: Array<string | React.ReactNode> = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const n = Number(match[1]);
    const cite = citations.find((c) => c.n === n);
    if (!cite) {
      // Post-prune orphan; drop the marker entirely.
      last = match.index + match[0].length;
      continue;
    }
    parts.push(<CitationRef key={`${match.index}-${n}`} cite={cite} />);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function kindLabel(kind: FigureCitation["kind"]): string {
  switch (kind) {
    case "chunk":
      return "Corpus";
    case "memory":
      return "Country Context";
    case "web":
      return "Web Research";
    case "citation":
      return "Citation";
    default:
      return "Source";
  }
}

function CitationCard({ cite }: { cite: FigureCitation }) {
  return (
    <div className="w-80 space-y-2 p-1">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-block border border-line-200 bg-paper-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-700">
          {kindLabel(cite.kind)}
        </span>
        {cite.org && (
          <span className="truncate font-mono text-[9px] uppercase tracking-widest text-ink-500">
            {cite.org}
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug text-ink-950">
        {cite.title || "Untitled source"}
      </p>
      {cite.excerpt && (
        <p className="line-clamp-6 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-700">
          {cite.excerpt}
        </p>
      )}
      {cite.url && (
        <a
          href={cite.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-ink-950 underline underline-offset-2 hover:text-ink-700"
        >
          Open source ↗
        </a>
      )}
    </div>
  );
}

function CitationRef({ cite }: { cite: FigureCitation }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label={`Source ${cite.n}: ${cite.title || "untitled"}`}
          className="mx-0.5 inline align-super font-mono text-[10px] text-ink-950 underline underline-offset-2 hover:text-ink-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-950"
        >
          [{cite.n}]
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto p-3"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <CitationCard cite={cite} />
      </PopoverContent>
    </Popover>
  );
}

function CitationRow({ cite }: { cite: FigureCitation }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full cursor-pointer text-left text-[11px] leading-snug text-ink-500 hover:text-ink-950"
        >
          <span className="font-mono text-ink-950">[{cite.n}]</span>{" "}
          <span className="underline underline-offset-2">
            {cite.title || cite.url || "Untitled source"}
          </span>
          {cite.org && <span className="ml-1 text-ink-500/70">· {cite.org}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-3">
        <CitationCard cite={cite} />
      </PopoverContent>
    </Popover>
  );
}

