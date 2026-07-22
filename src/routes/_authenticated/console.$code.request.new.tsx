// AI-first request wizard for country users. Four short steps in minister
// language. Reuses the existing submitRequest server fn but exposes NO
// chamber terminology on the requester surface.

import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2, Paperclip } from "lucide-react";

import { getConsoleStudy } from "@/lib/console/console.functions";
import { submitRequest } from "@/lib/concierge/concierge.functions";
import { LANE_ORDER, LEXICON, type ChamberId } from "@/lib/concierge/minister-lexicon";
import { DEFAULT_TURNAROUND } from "@/lib/concierge/elapsed";
import { VoiceMicButton } from "@/components/console/VoiceMicButton";
import { AttachmentChip } from "@/components/console/AttachmentChip";
import { useConsoleUploads } from "@/hooks/useConsoleUploads";

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

type OutcomeChoice = {
  chamber: ChamberId | "other";
  title: string;      // plain-language label
  helper: string;     // one-liner
};

const OUTCOMES: OutcomeChoice[] = [
  ...LANE_ORDER.map<OutcomeChoice>((cid) => ({
    chamber: cid,
    title: LEXICON[cid].ministerLabel,
    helper: LEXICON[cid].oneLiner,
  })),
  {
    chamber: "other",
    title: "Something else",
    helper: "Tell us in your own words and we'll route it to the right team.",
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
  const [outcome, setOutcome] = useState<OutcomeChoice | null>(null);
  const [when, setWhen] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploads = useConsoleUploads(code);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const canNext =
    (step === 1 && (text.trim().length > 6 || uploads.anyReadable) && uploads.ready) ||
    (step === 2 && !!ministry) ||
    (step === 3 && !!outcome) ||
    step === 4;

  async function handleSubmit() {
    if (!outcome) return;
    setSubmitting(true);
    setError(null);
    try {
      const chamber: ChamberId = outcome.chamber === "other" ? "ledger" : outcome.chamber;
      const attachments = uploads.files
        .filter((f) => f.status === "ready" && f.path)
        .map((f) => ({
          path: f.path!,
          name: f.name,
          size: f.size,
          content_type: f.mime,
          summary: f.excerpt?.slice(0, 600),
        }));
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
          internal_chamber: chamber,
          chamber_confidence: outcome.chamber === "other" ? 0.3 : 0.8,
          attachments,
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
  const turnaround =
    outcome && outcome.chamber !== "other"
      ? study.data?.lanes.find((l) => l.chamber === outcome.chamber)?.turnaroundLabel ??
        DEFAULT_TURNAROUND[outcome.chamber]
      : outcome
        ? DEFAULT_TURNAROUND.other
        : null;

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
          <h1 className="font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
            What's on your mind?
          </h1>
          <p className="mt-3 text-ink-500">
            Say it, type it, or drop in a document. A sentence is enough.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="e.g. I'm weighing a change to cruise passenger tax next fiscal year. I want to see what it does to revenue and to tourism-sector jobs before I take it to cabinet."
            className="mt-6 w-full border border-line-200 bg-paper-0 p-4 font-serif text-base text-ink-950 placeholder:text-ink-500/60 focus:border-ink-950 focus:outline-none sm:p-5 sm:text-lg"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VoiceMicButton
              onTranscript={(t) => setText((prev) => (prev ? `${prev.trim()} ${t}` : t))}
              label="Speak"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploads.capacity <= 0}
              className="inline-flex min-h-[44px] items-center gap-2 border border-ink-950 bg-paper-0 px-4 text-xs font-mono uppercase tracking-[0.18em] text-ink-950 hover:bg-ink-950 hover:text-paper-50 disabled:opacity-40"
            >
              <Paperclip size={14} /> Attach
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploads.capacity <= 0}
              className="inline-flex min-h-[44px] items-center gap-2 border border-line-200 bg-paper-0 px-4 text-xs font-mono uppercase tracking-[0.18em] text-ink-950 hover:border-ink-950 disabled:opacity-40 sm:hidden"
            >
              📷 Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.heic,.mp3,.wav,.m4a"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploads.add(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploads.add(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Up to {uploads.capacity} more · 20MB each
            </span>
          </div>

          {uploads.files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {uploads.files.map((u) => (
                <AttachmentChip key={u.id} upload={u} onRemove={uploads.remove} />
              ))}
            </div>
          )}
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
                  className={selected ? "card-choice-active p-4 text-left" : "card-choice p-4 text-left"}
                >
                  <p className="font-serif text-base">{m.name}</p>
                </button>
              );
            })}
            {["Prime Minister's Office", "Cross-ministry"].map((n) => {
              const selected = ministry === n;
              return (
                <button
                  key={n}
                  onClick={() => setMinistry(n)}
                  className={selected ? "card-choice-active p-4 text-left" : "card-choice p-4 text-left"}
                >
                  <p className="font-serif text-base">{n}</p>
                </button>
              );
            })}
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {OUTCOMES.map((o) => {
              const selected = outcome?.chamber === o.chamber;
              const est =
                o.chamber === "other"
                  ? DEFAULT_TURNAROUND.other
                  : study.data?.lanes.find((l) => l.chamber === o.chamber)?.turnaroundLabel ??
                    DEFAULT_TURNAROUND[o.chamber];
              return (
                <button
                  key={o.chamber}
                  onClick={() => setOutcome(o)}
                  className={selected ? "card-choice-active p-5 text-left" : "card-choice p-5 text-left"}
                >
                  <p className="font-serif text-lg">{o.title}</p>
                  <p className={`mt-1 text-sm ${selected ? "opacity-80" : "text-ink-500"}`}>
                    {o.helper}
                  </p>
                  <p className={`mt-3 font-mono text-[10px] uppercase tracking-[0.2em] ${selected ? "opacity-80" : "text-ink-500"}`}>
                    {est}
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
                className={
                  when === w
                    ? "card-choice-active px-4 py-2 text-sm"
                    : "card-choice px-4 py-2 text-sm"
                }
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
              {turnaround && (
                <li>
                  <span className="text-ink-950">Response window:</span> {turnaround}
                </li>
              )}
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
            className="btn-primary px-6 py-3 text-sm uppercase tracking-[0.15em]"
          >
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button
            disabled={submitting || !outcome || !ministry}
            onClick={handleSubmit}
            className="btn-primary px-6 py-3 text-sm uppercase tracking-[0.15em]"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Send to our team
          </button>
        )}
      </div>
    </div>
  );
}
