// Study hero composer with Ask ↔ Send mode toggle. Voice-in for both modes.
// Ask → navigates to /console/$code/ask?q=… (Second Brain chat).
// Send → navigates to /console/$code/request/new?seed=… (multimodal wizard).

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Brain, Sparkles } from "lucide-react";
import { VoiceMicButton } from "@/components/console/VoiceMicButton";

type Mode = "ask" | "send";

export function StudyComposer({
  code,
  turnaround,
  initialMode = "ask",
}: {
  code: string;
  turnaround?: string;
  initialMode?: Mode;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 2;

  function appendTranscript(t: string) {
    setText((prev) => (prev ? `${prev.trim()} ${t}` : t));
  }

  function submit() {
    if (!canSubmit) return;
    const trimmed = text.trim();
    if (mode === "ask") {
      navigate({
        to: "/console/$code/ask",
        params: { code },
        search: { q: trimmed } as never,
      });
    } else {
      navigate({
        to: "/console/$code/request/new",
        params: { code },
        search: { seed: trimmed } as never,
      });
    }
  }

  const heading = mode === "ask" ? "What do you want to know?" : "What do you need?";
  const placeholder =
    mode === "ask"
      ? "e.g. What's driving inflation this quarter? What did we conclude on cruise passenger tax?"
      : "e.g. I'm weighing a change to cruise passenger tax next fiscal year. I want to see what it does to revenue and to tourism jobs before I take it to cabinet.";
  const hint =
    mode === "ask"
      ? "Your Second Brain answers in seconds — with citations."
      : "Our team returns a full brief you can take to cabinet.";

  return (
    <section className="relative overflow-hidden border border-ink-950 bg-paper-0">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3 border-b border-line-200 px-4 py-3 sm:px-6">
        {/* Segmented control */}
        <div
          role="tablist"
          aria-label="Mode"
          className="inline-flex rounded-full border border-line-200 bg-paper-50 p-1"
        >
          {(["ask", "send"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(m)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-xs font-mono uppercase tracking-[0.2em] transition ${
                  active
                    ? "bg-ink-950 text-paper-50 shadow-sm"
                    : "text-ink-500 hover:text-ink-950"
                }`}
              >
                {m === "ask" ? <Brain size={12} /> : <Sparkles size={12} />}
                {m === "ask" ? "Ask" : "Send"}
              </button>
            );
          })}
        </div>
        {mode === "send" && turnaround && (
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 sm:inline">
            {turnaround}
          </span>
        )}
      </div>

      <div className="relative px-4 py-5 sm:px-6 sm:py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
          {mode === "ask" ? "Ask the Second Brain" : "Start a request"}
        </p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink-950 sm:text-3xl">
          {heading}
        </h2>
        <p className="mt-2 max-w-lg text-sm text-ink-500 sm:text-base">{hint}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-5 min-h-[6.5rem] w-full resize-y border border-line-200 bg-paper-50 p-3 font-serif text-base leading-relaxed text-ink-950 placeholder:text-ink-500/60 focus:border-ink-950 focus:outline-none sm:min-h-[9rem] sm:p-4 sm:text-lg"
        />

        <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <VoiceMicButton onTranscript={appendTranscript} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="btn-primary inline-flex min-h-[48px] w-full items-center justify-center gap-2 px-5 text-sm uppercase tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {mode === "ask" ? "Ask" : "Continue"} <ArrowRight size={14} />
          </button>
        </div>

        {mode === "send" && turnaround && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 sm:hidden">
            {turnaround}
          </p>
        )}
      </div>
    </section>
  );
}
