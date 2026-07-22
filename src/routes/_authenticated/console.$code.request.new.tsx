// AI-first request wizard for country users. Four short steps in minister
// language. Reuses the existing submitRequest server fn but exposes NO
// chamber terminology on the requester surface.

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { getConsoleStudy } from "@/lib/console/console.functions";
import { submitRequest } from "@/lib/concierge/concierge.functions";
import type { ChamberId } from "@/lib/concierge/minister-lexicon";

const searchSchema = z.object({ seed: z.string().optional() });

export const Route = createFileRoute("/_authenticated/console/$code/request/new")({
  head: () => ({
    meta: [
      { title: "Start a request — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: RequestWizard,
});

// Four outcomes shown to the user, in plain English. Each maps privately to
// an internal chamber the agency uses to fulfil the work. The user never
// sees the chamber name.
type Outcome = {
  key: "brief" | "decision" | "statement" | "research";
  title: string;
  helper: string;
  chamber: ChamberId;
};

const OUTCOMES: Outcome[] = [
  {
    key: "brief",
    title: "A written brief on where things stand",
    helper: "Numbers, trends, what's driving them, what to watch. Ready to read in one sitting.",
    chamber: "ledger",
  },
  {
    key: "decision",
    title: "A decision paper with options and a recommendation",
    helper: "Trade-offs modelled, risks flagged, a clear recommendation you can act on.",
    chamber: "scenario",
  },
  {
    key: "statement",
    title: "A public message drafted for you",
    helper: "Remarks, press statement or op-ed — grounded, ready to review.",
    chamber: "narrative",
  },
  {
    key: "research",
    title: "Research on how people feel about it",
    helper: "Structured listening: who thinks what, why, and what would move them.",
    chamber: "persona",
  },
];

function RequestWizard() {
  const { code } = Route.useParams();
  const { seed } = Route.useSearch();
  const navigate = useNavigate();

  const study = useQuery({
    queryKey: ["console-study", code],
    queryFn: () => getConsoleStudy({ data: { country_code: code } }),
  });

  const [step, setStep] = useState(1);
  const [text, setText] = useState(seed ?? "");
  const [ministry, setMinistry] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [when, setWhen] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext =
    (step === 1 && text.trim().length > 6) ||
    (step === 2 && !!ministry) ||
    (step === 3 && !!outcome) ||
    step === 4;

  async function handleSubmit() {
    if (!outcome) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await submitRequest({
        data: {
          country_code: code,
          raw_text: text,
          channel: "typed",
          minister_summary: text.slice(0, 500),
          request_card: {
            question: text.slice(0, 400),
            why_it_matters: "",
            deliverable_shape: outcome.title,
            built_on: ministry ? [`Ministry: ${ministry}`] : [],
            when_needed: when,
          },
          internal_chamber: outcome.chamber,
          chamber_confidence: 0.7,
          attachments: [],
        },
      });
      navigate({ to: "/console/$code/requests/$id", params: { code, id: row.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const ministries = study.data?.ministries ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <ol className="mb-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
        {["What you need", "Which ministry", "What form", "When"].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border ${
                  active
                    ? "border-ink-950 bg-ink-950 text-paper-50"
                    : done
                      ? "border-gold-500 bg-gold-500 text-paper-50"
                      : "border-line-200 text-ink-500"
                }`}
              >
                {done ? <Check size={12} /> : n}
              </span>
              <span className={active ? "text-ink-950" : ""}>{label}</span>
              {n < 4 && <span className="mx-2 h-px w-6 bg-line-200" />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section>
          <h1 className="font-serif text-4xl leading-tight text-ink-950">
            What's on your mind?
          </h1>
          <p className="mt-3 text-ink-500">
            Say it in your own words. A sentence is enough. A paragraph is fine too.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="e.g. I'm weighing a change to cruise passenger tax next fiscal year. I want to see what it does to revenue and to tourism-sector jobs before I take it to cabinet."
            className="mt-6 w-full border border-line-200 bg-paper-0 p-5 font-serif text-lg text-ink-950 placeholder:text-ink-500/60 focus:border-ink-950 focus:outline-none"
          />
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="font-serif text-4xl leading-tight text-ink-950">
            Which ministry does this belong to?
          </h1>
          <p className="mt-3 text-ink-500">
            We'll route the work to the right team and keep the file with your other {ministry ?? "ministry"} items.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {ministries.map((m) => {
              const selected = ministry === m.name;
              return (
                <button
                  key={m.id}
                  onClick={() => setMinistry(m.name)}
                  className={`border p-4 text-left transition ${
                    selected
                      ? "border-ink-950 bg-ink-950 text-paper-50"
                      : "border-line-200 bg-paper-0 hover:border-ink-950"
                  }`}
                >
                  <p className="font-serif text-base">{m.name}</p>
                </button>
              );
            })}
            <button
              onClick={() => setMinistry("Prime Minister's Office")}
              className={`border p-4 text-left transition ${
                ministry === "Prime Minister's Office"
                  ? "border-ink-950 bg-ink-950 text-paper-50"
                  : "border-line-200 bg-paper-0 hover:border-ink-950"
              }`}
            >
              <p className="font-serif text-base">Prime Minister's Office</p>
            </button>
            <button
              onClick={() => setMinistry("Cross-ministry")}
              className={`border p-4 text-left transition ${
                ministry === "Cross-ministry"
                  ? "border-ink-950 bg-ink-950 text-paper-50"
                  : "border-line-200 bg-paper-0 hover:border-ink-950"
              }`}
            >
              <p className="font-serif text-base">Cross-ministry</p>
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1 className="font-serif text-4xl leading-tight text-ink-950">
            What form should the answer take?
          </h1>
          <p className="mt-3 text-ink-500">
            Pick the closest one. Our team may add companion material if it helps.
          </p>
          <div className="mt-6 grid gap-3">
            {OUTCOMES.map((o) => {
              const selected = outcome?.key === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setOutcome(o)}
                  className={`border p-5 text-left transition ${
                    selected
                      ? "border-ink-950 bg-ink-950 text-paper-50"
                      : "border-line-200 bg-paper-0 hover:border-ink-950"
                  }`}
                >
                  <p className="font-serif text-lg">{o.title}</p>
                  <p className={`mt-1 text-sm ${selected ? "text-paper-50/80" : "text-ink-500"}`}>
                    {o.helper}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <h1 className="font-serif text-4xl leading-tight text-ink-950">
            When do you need it?
          </h1>
          <p className="mt-3 text-ink-500">
            A rough window is fine. If it's urgent, say so.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Today", "This week", "Next week", "Before cabinet", "No rush"].map((w) => (
              <button
                key={w}
                onClick={() => setWhen(w)}
                className={`border px-4 py-2 text-sm transition ${
                  when === w
                    ? "border-ink-950 bg-ink-950 text-paper-50"
                    : "border-line-200 bg-paper-0 hover:border-ink-950"
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="mt-10 border border-line-200 bg-paper-0 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              About to send
            </p>
            <p className="mt-3 line-clamp-3 font-serif text-lg text-ink-950">{text}</p>
            <ul className="mt-4 space-y-1 text-sm text-ink-500">
              <li><span className="text-ink-950">Ministry:</span> {ministry}</li>
              <li><span className="text-ink-950">Form:</span> {outcome?.title}</li>
              {when && <li><span className="text-ink-950">Timing:</span> {when}</li>}
            </ul>
          </div>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        </section>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-line-200 pt-6">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate({ to: "/console/$code", params: { code } }))}
          className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-950"
        >
          <ArrowLeft size={14} /> {step === 1 ? "Back to study" : "Back"}
        </button>
        {step < 4 ? (
          <button
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-paper-50 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button
            disabled={submitting || !outcome || !ministry}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-paper-50 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Send to our team
          </button>
        )}
      </div>
    </div>
  );
}
