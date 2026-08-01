// The participant's door. A coded invitation link resolves one questionnaire,
// renders it plainly, and files the return. No account, no chrome, no tracking
// beyond the invitation's own state — and no login, ever.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

interface Question {
  id: string;
  type: string;
  prompt: string;
  help?: string;
  required?: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
  rows?: string[];
}

interface Resolved {
  state: "ok" | "done" | "closed" | "opted_out" | "invalid" | "error";
  firstName?: string;
  instrument?: {
    title: string | null;
    intro: string | null;
    outro: string | null;
    questions: Question[];
  };
}

export const Route = createFileRoute("/f/$token")({
  head: () => ({
    meta: [
      { title: "Your invitation — national research programme" },
      {
        name: "description",
        content:
          "You have been invited to take part in a confidential national research programme. Your answers are reported only in aggregate.",
      },
      { property: "og:title", content: "Your invitation — national research programme" },
      {
        property: "og:description",
        content: "A short confidential questionnaire. Your answers are reported only in aggregate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParticipantPage,
});

/* ------------------------------------------------------------------ */
/* The masthead every state shares — so the page always looks addressed */
/* to the person holding the link, never like an app that lost its way. */
/* ------------------------------------------------------------------ */

function Masthead({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <header className="border-b border-line-200 pb-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
        {kicker ?? "Confidential research"}
      </p>
      <h1 className="mt-2 font-serif text-[30px] leading-[1.15] text-ink-950 sm:text-4xl">
        {title}
      </h1>
    </header>
  );
}

function Notice({ title, body, closing }: { title: string; body: string; closing?: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:py-20">
      <Masthead title={title} />
      <p className="mt-5 text-[15px] leading-relaxed text-ink-700">{body}</p>
      {closing ? <p className="mt-6 text-[13px] text-ink-500">{closing}</p> : null}
    </main>
  );
}

function readingMinutes(count: number) {
  return Math.max(1, Math.round(count * 0.4));
}

function ParticipantPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Resolved | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  const wantsOptOut = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("opt_out") === "1",
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (wantsOptOut) {
          const res = await fetch(`/api/public/field/${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opt_out: true }),
          });
          if (!cancelled) setData((await res.json()) as Resolved);
          return;
        }
        const res = await fetch(`/api/public/field/${token}`);
        if (!cancelled) setData((await res.json()) as Resolved);
      } catch {
        if (!cancelled) setData({ state: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, wantsOptOut]);

  // Draft answers survive a reload — a long questionnaire is never lost.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`field-draft-${token}`);
      if (saved) setAnswers(JSON.parse(saved) as Record<string, unknown>);
    } catch {
      /* no draft */
    }
  }, [token]);
  useEffect(() => {
    try {
      window.localStorage.setItem(`field-draft-${token}`, JSON.stringify(answers));
    } catch {
      /* storage unavailable */
    }
  }, [answers, token]);

  if (!data)
    return (
      <Notice title="One moment" body="Fetching your questionnaire. This takes a few seconds." />
    );
  if (data.state === "invalid")
    return (
      <Notice
        title="This link is not recognised"
        body="The invitation may have been mistyped or shortened by a messaging app. Please open the exact link from your invitation message."
        closing="If the trouble continues, reply to the message that invited you and a fresh link will be sent."
      />
    );
  if (data.state === "opted_out")
    return (
      <Notice
        title="You will not be contacted again"
        body="Your preference has been recorded and no further messages will be sent to you about this programme."
        closing="Thank you for letting us know."
      />
    );
  if (data.state === "done")
    return (
      <Notice
        title="Thank you — your answers are recorded"
        body="Your response has been received. It is held confidentially and reported only in aggregate, alongside everyone else who took part."
        closing="You may close this page. Nothing further is needed from you."
      />
    );
  if (data.state === "closed")
    return (
      <Notice
        title="This questionnaire has closed"
        body="Fieldwork for this programme has finished and no further answers can be accepted."
        closing="Thank you for your interest in taking part."
      />
    );
  if (data.state !== "ok" || !data.instrument)
    return (
      <Notice
        title="Something went wrong"
        body="We could not load your questionnaire just now. Please try the link again in a few minutes."
      />
    );

  const questions = (data.instrument.questions ?? []).filter((q) => q.type !== "moderator_prompt");
  const isAnswered = (q: Question) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  };
  const answeredCount = questions.filter(isAnswered).length;
  const missing = questions.filter((q) => q.required && !isAnswered(q));
  const pct = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100);

  const submit = async () => {
    if (missing.length > 0) {
      const first = missing[0];
      const index = questions.findIndex((q) => q.id === first?.id);
      setError(
        `${missing.length} required question${missing.length === 1 ? "" : "s"} still to answer — starting with question ${index + 1}.`,
      );
      const node = listRef.current?.querySelector(`[data-q="${first?.id}"]`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/field/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const out = (await res.json()) as Resolved;
      window.localStorage.removeItem(`field-draft-${token}`);
      setData(out);
      window.scrollTo({ top: 0 });
    } catch {
      setError("Your answers could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const set = (id: string, v: unknown) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <div className="min-h-screen bg-paper-50">
      {/* Honest progress, always in view. */}
      <div className="sticky top-0 z-20 border-b border-line-200 bg-paper-0/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-2">
          <div className="h-1 flex-1 bg-line-100">
            <div
              className="h-1 bg-ink-950 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] tabular-nums text-ink-600">
            {answeredCount} of {questions.length} answered
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl px-5 pb-40 pt-10 sm:pt-14">
        <Masthead title={data.instrument.title ?? "Questionnaire"} />

        {data.firstName ? (
          <p className="mt-4 text-[15px] text-ink-800">
            Thank you for taking part, {data.firstName}.
          </p>
        ) : null}
        {data.instrument.intro ? (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{data.instrument.intro}</p>
        ) : null}

        {/* The instruction beat: what is being asked of them, before beat one. */}
        <section className="mt-6 border border-line-200 bg-paper-0 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Before you begin
          </p>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-700">
            <li className="flex gap-2">
              <span className="font-mono text-[11px] text-ink-400">01</span>
              <span>
                {questions.length} question{questions.length === 1 ? "" : "s"} — about{" "}
                {readingMinutes(questions.length)} minute
                {readingMinutes(questions.length) === 1 ? "" : "s"}. Questions marked{" "}
                <span className="text-ink-950">*</span> must be answered.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-[11px] text-ink-400">02</span>
              <span>
                Your answers are confidential. Nothing is published that identifies you — findings
                are reported only in aggregate.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-[11px] text-ink-400">03</span>
              <span>
                Your progress saves on this device as you go. You may close the page and return to
                the same link later, and you may stop at any time.
              </span>
            </li>
          </ul>
        </section>

        <ol ref={listRef} className="mt-8 space-y-4">
          {questions.map((q, i) => (
            <li
              key={q.id}
              data-q={q.id}
              className="border border-line-200 bg-paper-0 p-4 sm:p-5"
            >
              <p className="font-serif text-[18px] leading-snug text-ink-950">
                <span className="mr-2 font-mono text-[11px] tabular-nums text-ink-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {q.prompt}
                {q.required ? (
                  <span className="ml-1 text-ink-500" aria-label="required">
                    *
                  </span>
                ) : null}
              </p>
              {q.help ? (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{q.help}</p>
              ) : null}
              <div className="mt-4">
                <QuestionField q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
              </div>
            </li>
          ))}
        </ol>

        {data.instrument.outro ? (
          <p className="mt-8 text-[14px] leading-relaxed text-ink-700">{data.instrument.outro}</p>
        ) : null}

        <p className="mt-8 text-[12px] leading-relaxed text-ink-500">
          If you would rather not take part,{" "}
          <a className="underline" href={`/f/${token}?opt_out=1`}>
            opt out here
          </a>{" "}
          and you will not be contacted again about this programme.
        </p>
      </main>

      {/* The one action, always reachable. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-200 bg-paper-0/95 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-5 py-3">
          {error ? <p className="mb-2 text-[12px] text-signal-negative">{error}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-primary flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Sending…" : "Submit my answers"}
            </button>
            <span className="font-mono text-[11px] tabular-nums text-ink-500">
              {missing.length === 0
                ? "All required questions answered"
                : `${missing.length} required left`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const input =
    "w-full border border-line-200 bg-paper-0 p-3 text-[15px] focus:border-ink-950 focus:outline-none";
  const choice =
    "flex w-full items-start gap-3 border border-line-200 bg-paper-0 p-3 text-[15px] text-ink-800 transition-colors hover:border-ink-300";
  const choiceOn =
    "flex w-full items-start gap-3 border border-ink-950 bg-paper-50 p-3 text-[15px] text-ink-950";

  if (q.type === "single_choice") {
    return (
      <div className="space-y-2">
        {(q.options ?? []).map((o) => (
          <label key={o} className={value === o ? choiceOn : choice}>
            <input
              type="radio"
              name={q.id}
              checked={value === o}
              onChange={() => onChange(o)}
              className="mt-1 h-4 w-4"
            />
            <span>{o}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.type === "multi_choice") {
    const picked = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        {(q.options ?? []).map((o) => (
          <label key={o} className={picked.includes(o) ? choiceOn : choice}>
            <input
              type="checkbox"
              checked={picked.includes(o)}
              onChange={() =>
                onChange(picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o])
              }
              className="mt-1 h-4 w-4"
            />
            <span>{o}</span>
          </label>
        ))}
        <p className="text-[12px] text-ink-500">Choose as many as apply.</p>
      </div>
    );
  }

  if (q.type === "scale") {
    const min = q.scale_min ?? 1;
    const max = q.scale_max ?? 5;
    const steps = Array.from({ length: Math.max(2, max - min + 1) }, (_, i) => min + i);
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {steps.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={
                value === s
                  ? "card-choice-active min-w-11 px-4 py-3 font-mono text-[14px] tabular-nums"
                  : "card-choice min-w-11 px-4 py-3 font-mono text-[14px] tabular-nums"
              }
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
          <span>{q.scale_min_label ?? ""}</span>
          <span>{q.scale_max_label ?? ""}</span>
        </div>
      </div>
    );
  }

  if (q.type === "ranking") {
    const order = Array.isArray(value) ? (value as string[]) : [];
    const options = q.options ?? [];
    return (
      <div className="space-y-2">
        {options.map((o) => {
          const rank = order.indexOf(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(rank >= 0 ? order.filter((x) => x !== o) : [...order, o])}
              className={
                rank >= 0
                  ? "card-choice-active flex w-full items-center gap-3 px-3 py-3 text-left text-[15px]"
                  : "card-choice flex w-full items-center gap-3 px-3 py-3 text-left text-[15px]"
              }
            >
              <span className="font-mono text-[12px] tabular-nums text-ink-500">
                {rank >= 0 ? rank + 1 : "·"}
              </span>
              {o}
            </button>
          );
        })}
        <p className="text-[12px] text-ink-500">
          Tap in order of importance, most important first. Tap again to remove.
        </p>
      </div>
    );
  }

  if (q.type === "matrix") {
    const grid = (value ?? {}) as Record<string, number>;
    const min = q.scale_min ?? 1;
    const max = q.scale_max ?? 5;
    const steps = Array.from({ length: Math.max(2, max - min + 1) }, (_, i) => min + i);
    return (
      <div className="space-y-4">
        {(q.rows ?? []).map((row) => (
          <div key={row}>
            <p className="text-[14px] text-ink-800">{row}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...grid, [row]: s })}
                  className={
                    grid[row] === s
                      ? "card-choice-active min-w-11 px-4 py-2 font-mono text-[13px] tabular-nums"
                      : "card-choice min-w-11 px-4 py-2 font-mono text-[13px] tabular-nums"
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <textarea
      rows={4}
      className={input}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your answer"
    />
  );
}
