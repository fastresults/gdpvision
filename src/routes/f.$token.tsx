// The participant's door. A coded invitation link resolves one questionnaire,
// renders it plainly, and files the return. No account, no chrome, no tracking
// beyond the invitation's own state.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

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

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="font-serif text-2xl text-ink-950">{title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-700">{body}</p>
    </div>
  );
}

function ParticipantPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Resolved | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!data) return <Notice title="One moment" body="Fetching your questionnaire." />;
  if (data.state === "invalid")
    return (
      <Notice
        title="This link is not recognised"
        body="The invitation may have been mistyped. Please use the exact link from your invitation message."
      />
    );
  if (data.state === "opted_out")
    return (
      <Notice
        title="You will not be contacted again"
        body="Your preference has been recorded and no further messages will be sent about this programme."
      />
    );
  if (data.state === "done")
    return (
      <Notice
        title="Thank you — your answers are recorded"
        body="Your response has been received. It is held confidentially and reported only in aggregate."
      />
    );
  if (data.state === "closed")
    return (
      <Notice
        title="This questionnaire has closed"
        body="Fieldwork for this programme has finished. Thank you for your interest."
      />
    );
  if (data.state !== "ok" || !data.instrument)
    return (
      <Notice
        title="Something went wrong"
        body="We could not load your questionnaire. Please try again shortly."
      />
    );

  const questions = (data.instrument.questions ?? []).filter(
    (q) => q.type !== "moderator_prompt",
  );
  const missing = questions.filter(
    (q) => q.required && (answers[q.id] === undefined || answers[q.id] === ""),
  );

  const submit = async () => {
    if (missing.length > 0) {
      setError(`${missing.length} required question${missing.length === 1 ? "" : "s"} left.`);
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
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Confidential research
      </p>
      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink-950">
        {data.instrument.title ?? "Questionnaire"}
      </h1>
      {data.firstName ? (
        <p className="mt-2 text-[13px] text-ink-600">
          Thank you for taking part, {data.firstName}.
        </p>
      ) : null}
      {data.instrument.intro ? (
        <p className="mt-4 text-[14px] leading-relaxed text-ink-700">{data.instrument.intro}</p>
      ) : null}

      <ol className="mt-8 space-y-8">
        {questions.map((q, i) => (
          <li key={q.id} className="border-t border-line-200 pt-5">
            <p className="font-serif text-[17px] leading-snug text-ink-950">
              <span className="mr-2 font-mono text-[11px] text-ink-500">{i + 1}</span>
              {q.prompt}
              {q.required ? <span className="ml-1 text-ink-500">*</span> : null}
            </p>
            {q.help ? <p className="mt-1 text-[12px] text-ink-600">{q.help}</p> : null}
            <div className="mt-3">
              <QuestionField q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
            </div>
          </li>
        ))}
      </ol>

      {error ? <p className="mt-6 text-[12px] text-rose-600">{error}</p> : null}

      <div className="mt-8 flex items-center gap-3 border-t border-line-200 pt-5">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "Sending…" : "Submit my answers"}
        </button>
        <span className="font-mono text-[11px] tabular-nums text-ink-500">
          {questions.length - missing.length}/{questions.length} answered
        </span>
      </div>
      <p className="mt-6 text-[11px] leading-relaxed text-ink-500">
        Your answers are confidential and reported only in aggregate. If you would rather not take
        part, <a className="underline" href={`/f/${token}?opt_out=1`}>opt out here</a>.
      </p>
    </main>
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
    "w-full border border-line-200 bg-paper-0 p-2 text-[14px] focus:border-ink-950 focus:outline-none";

  if (q.type === "single_choice") {
    return (
      <div className="space-y-2">
        {(q.options ?? []).map((o) => (
          <label key={o} className="flex items-start gap-2 text-[14px] text-ink-800">
            <input
              type="radio"
              name={q.id}
              checked={value === o}
              onChange={() => onChange(o)}
              className="mt-1"
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
          <label key={o} className="flex items-start gap-2 text-[14px] text-ink-800">
            <input
              type="checkbox"
              checked={picked.includes(o)}
              onChange={() =>
                onChange(picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o])
              }
              className="mt-1"
            />
            <span>{o}</span>
          </label>
        ))}
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
                  ? "card-choice-active px-3 py-1 font-mono text-[12px] tabular-nums"
                  : "card-choice px-3 py-1 font-mono text-[12px] tabular-nums"
              }
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
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
              onClick={() =>
                onChange(rank >= 0 ? order.filter((x) => x !== o) : [...order, o])
              }
              className={
                rank >= 0
                  ? "card-choice-active flex w-full items-center gap-2 px-3 py-2 text-left text-[14px]"
                  : "card-choice flex w-full items-center gap-2 px-3 py-2 text-left text-[14px]"
              }
            >
              <span className="font-mono text-[11px] tabular-nums text-ink-500">
                {rank >= 0 ? rank + 1 : "·"}
              </span>
              {o}
            </button>
          );
        })}
        <p className="text-[11px] text-ink-500">Tap in order of importance, most important first.</p>
      </div>
    );
  }

  if (q.type === "matrix") {
    const grid = (value ?? {}) as Record<string, number>;
    const min = q.scale_min ?? 1;
    const max = q.scale_max ?? 5;
    const steps = Array.from({ length: Math.max(2, max - min + 1) }, (_, i) => min + i);
    return (
      <div className="space-y-3">
        {(q.rows ?? []).map((row) => (
          <div key={row}>
            <p className="text-[13px] text-ink-800">{row}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...grid, [row]: s })}
                  className={
                    grid[row] === s
                      ? "card-choice-active px-3 py-1 font-mono text-[12px] tabular-nums"
                      : "card-choice px-3 py-1 font-mono text-[12px] tabular-nums"
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
