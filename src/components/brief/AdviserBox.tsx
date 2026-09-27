// The adviser box on the Decision Brief. A visitor asks a question; the
// adviser answers from the brief's facts and arithmetic, cites what it used,
// and may propose one what-if. The page recomputes the what-if with the same
// deterministic model and shows the move before anything is applied.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { askBriefAdviser } from "@/lib/calculator/adviser.functions";
import type { AdviserAnswer, AdviserContext } from "@/lib/calculator/adviser.server";
import { computeValue, formatUsd, type Stance, type ValueInput } from "@/lib/calculator/model";
import { FRAMING_QUESTIONS } from "@/lib/calculator/model";

const PROMPTS = [
  "Why does the sequence start where it does?",
  "Which figure in this brief is weakest?",
  "What if Cabinet decided twice as fast?",
  "What would the Sector Studio alone release?",
];

const STANCES: Stance[] = ["conservative", "central", "optimistic"];

/** Turns an adviser what-if into a bounded patch on the input, or null. */
export function whatIfPatch(a: AdviserAnswer, input: ValueInput): Partial<ValueInput> | null {
  const v = a.what_if_value;
  switch (a.what_if_field) {
    case "none":
      return null;
    case "stance":
      return STANCES.includes(a.what_if_stance as Stance)
        ? { stance: a.what_if_stance as Stance }
        : null;
    case "chamber": {
      const idx = a.what_if_chamber.padStart(2, "0");
      if (!/^(0[1-9]|10)$/.test(idx)) return null;
      return {
        chambers: { ...input.chambers, [idx]: Math.round(Math.min(100, Math.max(0, v)) / 25) * 25 },
      };
    }
    case "publicSpendPct":
      return { publicSpendPct: Math.min(55, Math.max(10, v)) };
    default: {
      const q = FRAMING_QUESTIONS.find((x) => x.key === a.what_if_field);
      if (!q) return null;
      return {
        [q.key]: Math.min(q.max, Math.max(q.min, Math.round(v / q.step) * q.step)),
      } as Partial<ValueInput>;
    }
  }
}

interface Turn {
  q: string;
  a?: AdviserAnswer;
  error?: string;
  applied?: boolean;
}

export function AdviserBox({
  input,
  context,
  onApply,
  factLabel,
}: {
  input: ValueInput;
  context: () => AdviserContext;
  onApply: (patch: Partial<ValueInput>) => void;
  factLabel: (key: string) => string;
}) {
  const ask = useServerFn(askBriefAdviser);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const current = computeValue(input);

  async function submit(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [{ q: text }, ...t].slice(0, 6));
    try {
      const res = await ask({ data: { question: text, context: context() } });
      setTurns((t) =>
        t.map((x, i) =>
          i === 0 ? { ...x, ...(res.ok ? { a: res.answer } : { error: res.error }) } : x,
        ),
      );
    } catch {
      setTurns((t) =>
        t.map((x, i) =>
          i === 0 ? { ...x, error: "The adviser is unavailable. The brief is unaffected." } : x,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-line-200 bg-paper-0" aria-labelledby="adviser-h">
      <div className="flex items-center justify-between border-b border-line-200 px-5 py-4 sm:px-6">
        <h2
          id="adviser-h"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500"
        >
          Adviser · answers from this brief's record and arithmetic
        </h2>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-500" /> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(q);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label className="sr-only" htmlFor="adviser-q">
            Ask the adviser
          </label>
          <input
            id="adviser-q"
            value={q}
            maxLength={500}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about any figure, the sequence, or a what-if"
            className="min-w-0 flex-1 border border-line-200 bg-paper-0 px-4 py-2.5 text-[14px] text-ink-950 focus:border-ink-950 focus:outline-none"
          />
          <button
            type="submit"
            className="btn-primary px-4 py-2.5 text-xs"
            disabled={busy || q.trim().length < 3}
          >
            Ask
          </button>
        </form>
        {turns.length === 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => void submit(p)}
                disabled={busy}
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}

        <ol className="mt-5 space-y-6">
          {turns.map((t, i) => {
            const patch = t.a ? whatIfPatch(t.a, input) : null;
            const next = patch ? computeValue({ ...input, ...patch }) : null;
            return (
              <li key={`${t.q}-${i}`} className="border-l-2 border-line-200 pl-4">
                <p className="text-[13px] text-ink-500">{t.q}</p>
                {!t.a && !t.error ? (
                  <p className="mt-2 text-[13px] text-ink-400">Reading the brief…</p>
                ) : null}
                {t.error ? <p className="mt-2 text-[13px] text-signal-caution">{t.error}</p> : null}
                {t.a ? (
                  <>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-950">{t.a.answer}</p>
                    {t.a.cites.length > 0 ? (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                        From: {t.a.cites.map(factLabel).join(" · ")}
                      </p>
                    ) : null}
                    {patch && next ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-100 pt-3">
                        <span className="text-[13px] text-ink-700">
                          {t.a.what_if_label || "Proposed what-if"}: {formatUsd(current.upliftUsd)}{" "}
                          → {formatUsd(next.upliftUsd)} ({next.upliftPpOfGdp.toFixed(2)} pp)
                        </span>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          disabled={t.applied}
                          onClick={() => {
                            onApply(patch);
                            setTurns((all) =>
                              all.map((x, j) => (j === i ? { ...x, applied: true } : x)),
                            );
                          }}
                        >
                          {t.applied ? "Applied" : "Apply to the brief"}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="mt-5 text-[11.5px] leading-relaxed text-ink-400">
          The adviser reads only the public facts and the model output shown on this page. It
          proposes; the arithmetic decides.
        </p>
      </div>
    </section>
  );
}
