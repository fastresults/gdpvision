import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Mic, Paperclip, ChevronRight, ChevronLeft, Loader2, Send, Sparkles, X, Pencil } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import {
  getMyDraft,
  saveDraft,
  submitRequest,
  discardDraft,
  type RequestCard,
} from "@/lib/concierge/concierge.functions";
import {
  interpretIntent,
  draftRequestCard,
} from "@/lib/concierge/concierge-ai.functions";
import { LEXICON, type ChamberId } from "@/lib/concierge/minister-lexicon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/concierge/new")({
  validateSearch: z.object({ country: z.string().optional(), prefill: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "The Concierge — new request · GDPVision" },
      { name: "description", content: "Send a request to your team." },
      { property: "og:title", content: "The Concierge — GDPVision" },
      { property: "og:description", content: "Send a request to your team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl p-12">
      <h1 className="font-serif text-2xl text-ink-950">Something went wrong.</h1>
      <p className="mt-2 text-sm text-ink-500">{error.message}</p>
      <button onClick={reset} className="mt-4 text-sm underline">Try again</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-12">Not found.</div>,
  component: WizardPage,
});

const statusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});

interface DraftState {
  step: number;
  raw_text: string;
  channel: "typed" | "pasted" | "voice";
  minister_summary: string;
  request_card: RequestCard;
  internal_chamber: ChamberId | null;
  chamber_confidence: number | null;
  attachments: Array<{ path: string; name: string; size?: number; content_type?: string }>;
}

const EMPTY_CARD: RequestCard = {
  question: "",
  why_it_matters: "",
  deliverable_shape: "",
  built_on: [],
  when_needed: "",
};

const EMPTY_DRAFT: DraftState = {
  step: 1,
  raw_text: "",
  channel: "typed",
  minister_summary: "",
  request_card: EMPTY_CARD,
  internal_chamber: null,
  chamber_confidence: null,
  attachments: [],
};

function WizardPage() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const country = useMemo(() => {
    if (search.country) return search.country;
    const def = status.bindings.find((b) => b.is_default) ?? status.bindings[0];
    return def?.country_code ?? "";
  }, [search.country, status.bindings]);
  const countryName = useMemo(
    () => status.bindings.find((b) => b.country_code === country)?.name ?? country,
    [country, status.bindings],
  );

  const [state, setState] = useState<DraftState>({
    ...EMPTY_DRAFT,
    raw_text: search.prefill ?? "",
  });
  const [hydrated, setHydrated] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate existing draft.
  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    (async () => {
      const draft = await getMyDraft({ data: { country_code: country } });
      if (cancelled) return;
      if (draft) {
        setState({
          step: draft.step ?? 1,
          raw_text: draft.raw_text ?? (search.prefill ?? ""),
          channel: (draft.channel as DraftState["channel"]) ?? "typed",
          minister_summary: draft.minister_summary ?? "",
          request_card: (draft.request_card as RequestCard) ?? EMPTY_CARD,
          internal_chamber: (draft.internal_chamber as ChamberId | null) ?? null,
          chamber_confidence: draft.chamber_confidence ?? null,
          attachments: (draft.attachments as DraftState["attachments"]) ?? [],
        });
      }
      setHydrated(true);
      setTimeout(() => textareaRef.current?.focus(), 60);
    })();
    return () => { cancelled = true; };
  }, [country, search.prefill]);

  // Autosave (debounced) whenever state changes after hydration.
  useEffect(() => {
    if (!hydrated || !country) return;
    const t = setTimeout(() => {
      saveDraft({
        data: {
          country_code: country,
          step: state.step,
          raw_text: state.raw_text,
          channel: state.channel,
          minister_summary: state.minister_summary,
          request_card: state.request_card,
          internal_chamber: state.internal_chamber ?? undefined,
          chamber_confidence: state.chamber_confidence ?? undefined,
          attachments: state.attachments,
        },
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [state, hydrated, country]);

  async function runInterpret() {
    if (state.raw_text.trim().split(/\s+/).length < 6) return;
    setInterpreting(true);
    setError(null);
    try {
      const r = await interpretIntent({
        data: { raw_text: state.raw_text, country_code: country },
      });
      setState((s) => ({
        ...s,
        minister_summary: r.interpretation,
        internal_chamber: r.internal_chamber as ChamberId,
        chamber_confidence: r.confidence,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that.");
    } finally {
      setInterpreting(false);
    }
  }

  async function runDraftCard() {
    setDrafting(true);
    setError(null);
    try {
      const card = await draftRequestCard({
        data: {
          raw_text: state.raw_text,
          country_code: country,
          internal_chamber: state.internal_chamber ?? undefined,
        },
      });
      setState((s) => ({ ...s, request_card: card }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft the card.");
    } finally {
      setDrafting(false);
    }
  }

  async function goNext() {
    if (state.step === 1) {
      if (state.raw_text.trim().length < 8) return;
      if (!state.minister_summary) await runInterpret();
      setState((s) => ({ ...s, step: 2 }));
    } else if (state.step === 2) {
      if (!state.internal_chamber) return;
      if (!state.request_card.question) await runDraftCard();
      setState((s) => ({ ...s, step: 3 }));
    } else if (state.step === 3) {
      setState((s) => ({ ...s, step: 4 }));
    } else if (state.step === 4) {
      setState((s) => ({ ...s, step: 5 }));
    }
  }

  function goBack() {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) }));
  }

  async function onSubmit() {
    if (!state.internal_chamber) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await submitRequest({
        data: {
          country_code: country,
          raw_text: state.raw_text,
          channel: state.channel,
          minister_summary: state.minister_summary,
          request_card: state.request_card,
          internal_chamber: state.internal_chamber,
          chamber_confidence: state.chamber_confidence ?? 0.6,
          attachments: state.attachments,
        },
      });
      await qc.invalidateQueries({ queryKey: ["concierge", "mine"] });
      navigate({ to: "/concierge/$id", params: { id: row.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the request.");
      setSubmitting(false);
    }
  }

  async function onDiscard() {
    if (!country) return;
    await discardDraft({ data: { country_code: country } });
    navigate({ to: "/concierge" });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list: DraftState["attachments"] = [...state.attachments];
    for (const f of Array.from(files)) {
      const path = `${country}/${Date.now()}-${f.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const up = await supabase.storage.from("service-requests").upload(path, f, { upsert: false });
      if (!up.error) {
        list.push({ path, name: f.name, size: f.size, content_type: f.type });
      }
    }
    setState((s) => ({ ...s, attachments: list }));
    e.target.value = "";
  }

  if (!country) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <h1 className="font-serif text-2xl">No country assigned.</h1>
        <p className="mt-3 text-sm text-ink-500">Ask your administrator to add you to a country.</p>
      </div>
    );
  }

  const progressPct = ((state.step - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-paper-50">
      {/* Progress ribbon */}
      <div className="fixed inset-x-0 top-0 z-30 h-[2px] bg-line-200">
        <div
          className="h-full bg-ink-950 transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Top bar */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
        <Link to="/concierge" className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500 hover:text-ink-950">
          ← The Concierge
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
          {countryName} · Step {state.step} of 5
        </span>
        <button onClick={onDiscard} className="text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          Discard
        </button>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-[1fr_320px]">
        <section className="min-h-[60vh]">
          {state.step === 1 && (
            <Step1
              value={state.raw_text}
              channel={state.channel}
              onChange={(v, ch) => setState((s) => ({ ...s, raw_text: v, channel: ch ?? s.channel }))}
              textareaRef={textareaRef}
              onInterpret={runInterpret}
              interpreting={interpreting}
            />
          )}

          {state.step === 2 && (
            <Step2
              chamber={state.internal_chamber}
              onPick={(id) => setState((s) => ({ ...s, internal_chamber: id, request_card: EMPTY_CARD }))}
            />
          )}

          {state.step === 3 && (
            <Step3
              card={state.request_card}
              onCard={(card) => setState((s) => ({ ...s, request_card: card }))}
              onRegen={runDraftCard}
              drafting={drafting}
            />
          )}

          {state.step === 4 && (
            <Step4 attachments={state.attachments} onFile={onFile} onRemove={(path) => {
              setState((s) => ({ ...s, attachments: s.attachments.filter((a) => a.path !== path) }));
              supabase.storage.from("service-requests").remove([path]).catch(() => {});
            }} />
          )}

          {state.step === 5 && (
            <Step5 countryName={countryName} state={state} onSubmit={onSubmit} submitting={submitting} />
          )}

          {error && (
            <div className="mt-6 border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-700">{error}</div>
          )}

          {/* Nav */}
          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={state.step === 1}
              className="flex items-center gap-2 text-sm text-ink-500 disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Back
            </button>
            {state.step < 5 && (
              <button
                onClick={goNext}
                disabled={
                  (state.step === 1 && state.raw_text.trim().length < 8) ||
                  (state.step === 2 && !state.internal_chamber) ||
                  interpreting || drafting
                }
                className="flex items-center gap-2 bg-ink-950 px-5 py-2.5 text-sm text-paper-50 hover:opacity-90 disabled:opacity-30"
              >
                Continue <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>

        {/* AI companion pane */}
        <aside className="border-l border-line-200 pl-6">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
            <Sparkles size={12} /> Reading with you
          </p>
          <div className="mt-4 min-h-[8rem] text-sm leading-relaxed text-ink-700">
            {interpreting ? (
              <span className="inline-flex items-center gap-2 text-ink-500">
                <Loader2 size={14} className="animate-spin" /> Reading your note…
              </span>
            ) : state.minister_summary ? (
              <p className="font-serif italic">{state.minister_summary}</p>
            ) : (
              <p className="text-ink-500">
                Tell me what you'd like our office to work on, in your own words. I'll take it in and get
                it in front of the right team.
              </p>
            )}
          </div>

          {state.internal_chamber && state.step >= 2 && (
            <div className="mt-6 border-t border-line-200 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">What you'll get back</p>
              <p className="mt-2 font-serif text-base text-ink-950">
                {LEXICON[state.internal_chamber].requestShape}
              </p>
              <p className="mt-1 text-xs text-ink-500">{LEXICON[state.internal_chamber].description}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────────────

function Step1({
  value,
  channel,
  onChange,
  textareaRef,
  onInterpret,
  interpreting,
}: {
  value: string;
  channel: DraftState["channel"];
  onChange: (v: string, channel?: DraftState["channel"]) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInterpret: () => void;
  interpreting: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        // For MVP: append a note; full transcription can plug in later.
        onChange(
          value +
            (value.trim().length > 0 ? "\n\n" : "") +
            "[voice note attached — transcription pending]",
          "voice",
        );
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      // Ignore — user declined mic access.
    }
  }

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">Step one</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-ink-950">
        What would you like our office to work on, Minister?
      </h1>
      <p className="mt-3 text-ink-500">Speak freely. I'll take it in.</p>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value, "typed")}
        onBlur={() => value.trim().split(/\s+/).length >= 8 && onInterpret()}
        rows={9}
        placeholder="Start typing, paste a note, or hold to record…"
        className="mt-6 w-full resize-none border-0 border-b border-line-300 bg-transparent font-serif text-2xl leading-relaxed text-ink-950 placeholder:text-ink-500/60 focus:border-ink-950 focus:outline-none"
      />

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={toggleRecord}
          className={`flex items-center gap-2 border px-3 py-1.5 text-xs uppercase tracking-[0.15em] ${
            recording ? "border-rose-500 text-rose-600" : "border-line-300 text-ink-500 hover:border-ink-950 hover:text-ink-950"
          }`}
        >
          <Mic size={14} /> {recording ? "Recording — tap to stop" : "Hold to record"}
        </button>
        <button
          type="button"
          onClick={onInterpret}
          disabled={interpreting || value.trim().length < 8}
          className="text-xs uppercase tracking-[0.15em] text-ink-500 hover:text-ink-950 disabled:opacity-40"
        >
          {interpreting ? "Reading…" : "Read this now"}
        </button>
      </div>
    </div>
  );
}

function Step2({ chamber, onPick }: { chamber: ChamberId | null; onPick: (id: ChamberId) => void }) {
  const primary = chamber ?? "ledger";
  const others = (Object.keys(LEXICON) as ChamberId[]).filter((k) => k !== primary);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">Step two</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-ink-950">Confirm what you're asking for.</h1>
      <p className="mt-3 text-ink-500">
        Based on what you said, this is the shape of response our team will send back to you.
      </p>

      <button
        type="button"
        onClick={() => onPick(primary)}
        className={`mt-8 block w-full border p-6 text-left transition ${
          chamber ? "border-ink-950 bg-white" : "border-line-300 hover:border-ink-950"
        }`}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Your response will be</p>
        <h2 className="mt-2 font-serif text-2xl text-ink-950">{LEXICON[primary].requestShape}</h2>
        <p className="mt-2 text-sm text-ink-500">{LEXICON[primary].description}</p>
      </button>

      <button
        onClick={() => setExpanded((x) => !x)}
        className="mt-6 text-xs uppercase tracking-[0.15em] text-ink-500 hover:text-ink-950"
      >
        {expanded ? "Hide other kinds of response" : "Ask for something different"}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {others.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => { onPick(id); setExpanded(false); }}
              className="border border-line-200 p-4 text-left hover:border-ink-950"
            >
              <p className="font-serif text-lg text-ink-950">{LEXICON[id].requestShape}</p>
              <p className="mt-1 text-xs text-ink-500">{LEXICON[id].description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Step3({
  card,
  onCard,
  onRegen,
  drafting,
}: {
  card: RequestCard;
  onCard: (card: RequestCard) => void;
  onRegen: () => void;
  drafting: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">Step three</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-ink-950">Sharpen the ask.</h1>
      <p className="mt-3 text-ink-500">Edit anything that isn't quite right.</p>

      <div className="mt-8 space-y-6 border-l-2 border-ink-950/70 pl-5">
        <EditableField
          label="The question"
          value={card.question}
          onChange={(v) => onCard({ ...card, question: v })}
          multiline={false}
          drafting={drafting}
        />
        <EditableField
          label="Why it matters"
          value={card.why_it_matters}
          onChange={(v) => onCard({ ...card, why_it_matters: v })}
          multiline
          drafting={drafting}
        />
        <EditableField
          label="What you'll get back"
          value={card.deliverable_shape}
          onChange={(v) => onCard({ ...card, deliverable_shape: v })}
          drafting={drafting}
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">What we'll build it on</p>
          <ul className="mt-2 space-y-2">
            {(card.built_on ?? []).map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-ink-500" />
                <input
                  value={b}
                  onChange={(e) => {
                    const next = [...(card.built_on ?? [])];
                    next[i] = e.target.value;
                    onCard({ ...card, built_on: next });
                  }}
                  className="w-full border-0 bg-transparent py-1 font-serif text-base text-ink-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onCard({ ...card, built_on: (card.built_on ?? []).filter((_, j) => j !== i) })}
                  className="text-ink-500 hover:text-rose-600"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onCard({ ...card, built_on: [...(card.built_on ?? []), ""] })}
            className="mt-2 text-xs uppercase tracking-[0.15em] text-ink-500 hover:text-ink-950"
          >
            + Add another source
          </button>
        </div>
        <EditableField
          label="When you need it"
          value={card.when_needed}
          onChange={(v) => onCard({ ...card, when_needed: v })}
          drafting={drafting}
        />
      </div>

      <button
        onClick={onRegen}
        disabled={drafting}
        className="mt-6 text-xs uppercase tracking-[0.15em] text-ink-500 hover:text-ink-950 disabled:opacity-40"
      >
        {drafting ? "Redrafting…" : "Redraft this for me"}
      </button>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  drafting = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  drafting?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
        {label} <Pencil size={10} />
      </p>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="mt-2 w-full resize-none border-0 bg-transparent font-serif text-lg leading-relaxed text-ink-950 placeholder:text-ink-500/60 focus:outline-none"
          placeholder={drafting ? "Drafting…" : "…"}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full border-0 bg-transparent font-serif text-lg text-ink-950 placeholder:text-ink-500/60 focus:outline-none"
          placeholder={drafting ? "Drafting…" : "…"}
        />
      )}
    </div>
  );
}

function Step4({
  attachments,
  onFile,
  onRemove,
}: {
  attachments: DraftState["attachments"];
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (path: string) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">Step four</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-ink-950">Anything else?</h1>
      <p className="mt-3 text-ink-500">
        Attach any documents, notes, or images our team should see. Skip this if there's nothing to add.
      </p>

      <label className="mt-8 flex cursor-pointer items-center justify-center gap-3 border border-dashed border-line-300 p-10 text-ink-500 hover:border-ink-950 hover:text-ink-950">
        <Paperclip size={16} />
        <span>Drop files here, or click to attach</span>
        <input type="file" multiple onChange={onFile} className="hidden" />
      </label>

      {attachments.length > 0 && (
        <ul className="mt-6 space-y-2">
          {attachments.map((a) => (
            <li key={a.path} className="flex items-center justify-between border-b border-line-200 py-2 text-sm">
              <span className="text-ink-700">{a.name}</span>
              <button onClick={() => onRemove(a.path)} className="text-ink-500 hover:text-rose-600">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Step5({
  countryName,
  state,
  onSubmit,
  submitting,
}: {
  countryName: string;
  state: DraftState;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">Step five · Send it</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-ink-950">Ready when you are.</h1>

      <article className="mt-10 border border-line-200 bg-white p-10 shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-ink-950 font-serif text-lg text-ink-950">
          ✦
        </div>
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
          A request from the Office · {countryName}
        </p>

        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">The question</p>
          <p className="mt-2 font-serif text-2xl leading-snug text-ink-950">{state.request_card.question}</p>
        </section>
        {state.request_card.why_it_matters && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Why it matters</p>
            <p className="mt-2 font-serif text-lg text-ink-700">{state.request_card.why_it_matters}</p>
          </section>
        )}
        <section className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">What you'll get back</p>
          <p className="mt-2 font-serif text-lg text-ink-950">{state.request_card.deliverable_shape}</p>
        </section>
        {(state.request_card.built_on ?? []).length > 0 && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">What we'll build it on</p>
            <ul className="mt-2 space-y-1">
              {state.request_card.built_on.map((b, i) => (
                <li key={i} className="font-serif text-base text-ink-700">— {b}</li>
              ))}
            </ul>
          </section>
        )}
        {state.request_card.when_needed && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">When you need it</p>
            <p className="mt-2 font-serif text-lg">{state.request_card.when_needed}</p>
          </section>
        )}
        {state.attachments.length > 0 && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Attachments</p>
            <ul className="mt-2 space-y-1">
              {state.attachments.map((a) => (
                <li key={a.path} className="text-sm text-ink-700">— {a.name}</li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <button
        onClick={onSubmit}
        disabled={submitting || !state.request_card.question}
        className="mt-8 flex w-full items-center justify-center gap-3 bg-ink-950 py-4 text-sm uppercase tracking-[0.25em] text-paper-50 hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {submitting ? "Sending…" : "Send this to our team"}
      </button>
    </div>
  );
}
