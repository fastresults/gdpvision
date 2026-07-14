// Phase 4 — persistent "Ask the Ledger" right rail.
// Retrieval-only Q&A grounded in the Second Brain. Refuses ungrounded
// questions. Every answer offers "Pin to snapshots" (writes figure_snapshots).

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { askTheLedger, pinFigureSnapshot, type LedgerAnswer } from "@/lib/ledger.functions";

type Turn = {
  id: string;
  question: string;
  answer: LedgerAnswer | null;
  error?: string;
  pinnedAt?: string;
};

export function AskTheLedger({
  countryCode,
  countryName,
  sectorCode,
}: {
  countryCode: string;
  countryName: string;
  sectorCode?: string;
}) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const askFn = useServerFn(askTheLedger);
  const pinFn = useServerFn(pinFigureSnapshot);

  const ask = useMutation({
    mutationFn: (payload: { id: string; question: string }) =>
      askFn({
        data: { countryCode, question: payload.question, sectorCode },
      }).then((res) => ({ id: payload.id, res })),
    onSuccess: ({ id, res }) => {
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, answer: res } : t)));
    },
    onError: (err, vars) => {
      setTurns((prev) =>
        prev.map((t) => (t.id === vars.id ? { ...t, error: (err as Error).message } : t)),
      );
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || ask.isPending) return;
    const id = `t_${Date.now()}`;
    setTurns((prev) => [...prev, { id, question: q, answer: null }]);
    setInput("");
    ask.mutate({ id, question: q });
  }

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
        <div className="flex h-[70vh] w-96 flex-col border border-l-0 border-line-200 bg-paper-0 shadow-2xl">
          <header className="border-b border-line-200 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Second Brain · {countryName}
              {sectorCode && <span className="ml-2 text-ink-500/70">· {sectorCode}</span>}
            </p>
            <p className="mt-1 text-sm text-ink-950">Ask the Ledger</p>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <p className="text-xs text-ink-500">
                Grounded in this country's Second Brain only. Answers cite [N] sources and refuse
                when evidence is missing.
              </p>
            )}
            {turns.map((t) => (
              <TurnBlock key={t.id} turn={t} onPin={() => pin.mutate(t)} pinPending={pin.isPending} />
            ))}
            {ask.isPending && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Retrieving from Second Brain…
              </p>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-line-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(e as unknown as React.FormEvent);
                  }
                }}
                rows={2}
                placeholder="Ask about a figure, sector, or trend…"
                className="min-h-[3rem] flex-1 resize-none border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-950 placeholder:text-ink-500 focus:border-ink-950 focus:outline-none"
              />
              <button
                type="submit"
                disabled={ask.isPending || !input.trim()}
                className="border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-paper-0 hover:opacity-90 disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </form>
        </div>
      </div>
    </aside>
  );
}

function TurnBlock({
  turn,
  onPin,
  pinPending,
}: {
  turn: Turn;
  onPin: () => void;
  pinPending: boolean;
}) {
  return (
    <div className="border-l-2 border-line-200 pl-3">
      <p className="text-sm text-ink-950">{turn.question}</p>
      {turn.error && (
        <p className="mt-2 text-xs text-red-700">{turn.error}</p>
      )}
      {turn.answer && (
        <>
          {turn.answer.grounded && turn.answer.answer ? (
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
                <li key={c.n} className="text-[11px] leading-snug text-ink-500">
                  <span className="font-mono text-ink-950">[{c.n}]</span>{" "}
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-950">
                      {c.title}
                    </a>
                  ) : (
                    <span className="text-ink-700">{c.title}</span>
                  )}
                  {c.org && <span className="ml-1 text-ink-500/70">· {c.org}</span>}
                </li>
              ))}
            </ul>
          )}
          {turn.answer.grounded && (
            <button
              onClick={onPin}
              disabled={pinPending || !!turn.pinnedAt}
              className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950 disabled:opacity-60"
            >
              {turn.pinnedAt ? "✓ Pinned" : pinPending ? "Pinning…" : "Pin to snapshots"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Very light [N] → superscript-link renderer. Keeps the text otherwise plain.
function renderCitations(text: string, citations: Array<{ n: number; url: string | null }>) {
  const parts: Array<string | React.ReactNode> = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const n = Number(match[1]);
    const cite = citations.find((c) => c.n === n);
    parts.push(
      cite?.url ? (
        <a
          key={`${match.index}-${n}`}
          href={cite.url}
          target="_blank"
          rel="noreferrer"
          className="mx-0.5 align-super text-[10px] font-mono text-ink-950 underline underline-offset-2"
        >
          [{n}]
        </a>
      ) : (
        <span key={`${match.index}-${n}`} className="mx-0.5 align-super text-[10px] font-mono text-ink-500">
          [{n}]
        </span>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
