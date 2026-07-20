import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ClipboardList,
  FlaskConical,
  Layers,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { listSegments } from "@/lib/personas/generate.functions";
import { createStudy, listStudies } from "@/lib/personas/study.functions";
import { composeStudy, type ComposeStudyResult } from "@/lib/personas/compose-study.functions";



const searchSchema = z.object({ segmentId: z.string().optional() });

function studiesQuery(code: string) {
  return queryOptions({ queryKey: ["studies", code], queryFn: () => listStudies({ data: { countryCode: code } }) });
}
function segmentsQuery(code: string) {
  return queryOptions({
    queryKey: ["persona-segments", code],
    queryFn: () => listSegments({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/studies")({
  validateSearch: (s) => searchSchema.parse(s),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(studiesQuery(params.code)),
      context.queryClient.ensureQueryData(segmentsQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: StudiesPage,
});

type StudyKind = "survey" | "focus_group" | "creative_test";

const METHODS: Array<{
  id: StudyKind;
  label: string;
  produces: string;
  duration: string;
  bestFor: string;
  icon: typeof ClipboardList;
}> = [
  {
    id: "survey",
    label: "Survey",
    produces: "Structured answers across every persona in the segment",
    duration: "≈ 2–4 minutes",
    bestFor: "Sizing sentiment, comparing options, tracking over time",
    icon: ClipboardList,
  },
  {
    id: "focus_group",
    label: "Focus group",
    produces: "Moderated transcript with disagreement and follow-ups",
    duration: "≈ 3–6 minutes",
    bestFor: "Hearing objections, understanding language, richer nuance",
    icon: MessageSquare,
  },
  {
    id: "creative_test",
    label: "Creative test",
    produces: "Reaction to a message, slogan, or asset — per persona",
    duration: "≈ 2–3 minutes",
    bestFor: "Pressure-testing comms before it ships",
    icon: Target,
  },
];

const OBJECTIVE_EXAMPLES = [
  "Understand the emotional response",
  "Compare against the current position",
  "Surface objections we haven't heard",
  "Test clarity of the core message",
];

function StudiesPage() {
  const { code } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: studies } = useSuspenseQuery(studiesQuery(code));
  const { data: segments } = useSuspenseQuery(segmentsQuery(code));

  const [segmentId, setSegmentId] = useState<string>(search.segmentId ?? "");
  const [kind, setKind] = useState<StudyKind | "">("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");

  const stepDone = useMemo(
    () => ({ 1: !!segmentId, 2: !!kind, 3: title.trim().length >= 3 }),
    [segmentId, kind, title],
  );
  const currentStep = !stepDone[1] ? 1 : !stepDone[2] ? 2 : !stepDone[3] ? 3 : 3;

  const create = useMutation({
    mutationFn: (opts: { auto?: boolean }) =>
      createStudy({
        data: {
          countryCode: code,
          segmentId,
          kind: kind as StudyKind,
          title: title.trim(),
          objective: objective.trim() || undefined,
        },
      }).then((row) => ({ row, auto: !!opts.auto })),
    onSuccess: ({ row, auto }) => {
      qc.invalidateQueries({ queryKey: ["studies", code] });
      navigate({
        to: "/admin/countries/$code/personas/studies/$id",
        params: { code, id: row.id },
        search: auto ? { auto: 1 } : undefined,
      });
    },
  });

  // AI Composer — picks segment + method + framing automatically.
  const composerQ = useQuery({
    queryKey: ["study-composer", code, segments.length],
    queryFn: () => composeStudy({ data: { countryCode: code } }),
    enabled: segments.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const composed: ComposeStudyResult | undefined = composerQ.data;
  const applyComposed = (c: Extract<ComposeStudyResult, { ok: true }>) => {
    setSegmentId(c.segmentId);
    setKind(c.kind === "creative_test" ? "creative_test" : (c.kind as StudyKind));
    setTitle(c.title);
    setObjective(c.objective);
  };
  const runComposed = () => {
    if (!composed?.ok) return;
    applyComposed(composed);
    // create.mutate uses the state we just set — schedule after paint so state is applied.
    setTimeout(() => create.mutate({ auto: true }), 0);
  };

  const ready = stepDone[1] && stepDone[2] && stepDone[3];
  const chosenSegment = segments.find((s) => s.id === segmentId);
  const chosenMethod = METHODS.find((m) => m.id === kind);

  const step2Ref = useRef<HTMLElement | null>(null);
  const step3Ref = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const manualDetailsRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    if (currentStep === 2 && step2Ref.current) {
      step2Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (currentStep === 3 && step3Ref.current) {
      step3Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      titleInputRef.current?.focus();
    }
  }, [currentStep]);

  const nextLabel =
    currentStep === 1 ? "Pick a segment" : currentStep === 2 ? "Choose a method" : "Frame the question";

  const grouped = useMemo(() => {
    const running = studies.filter((s) => s.status === "running");
    const done = studies.filter((s) => s.status === "synthesized" || s.status === "complete");
    const drafts = studies.filter((s) => !running.includes(s) && !done.includes(s));
    return { running, done, drafts };
  }, [studies]);

  const manualDefaultOpen = !composerQ.isLoading && (!composed || !composed.ok);

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage 03 · Rehearse the conversation
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">AI composes your next study</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Grounded in {code}&rsquo;s brief, segments, and prior studies — the AI picks the audience, method, and
          question. Approve to launch, or edit before you do.
        </p>
      </header>




      {segments.length === 0 ? (
        <EmptyStart code={code} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Composer */}
          <div className="space-y-6">
            <AiComposerCard
              state={composerQ.isLoading ? "loading" : composed}
              onApprove={runComposed}
              onEdit={() => {
                if (composed?.ok) applyComposed(composed);
                if (manualDetailsRef.current) manualDetailsRef.current.open = true;
              }}
              onRecompose={() => composerQ.refetch()}
              isCreating={create.isPending}
              refetching={composerQ.isFetching && !composerQ.isLoading}
            />

            <details
              ref={manualDetailsRef}
              open={manualDefaultOpen}
              className="group border border-line-200 bg-paper-0"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 hover:bg-paper-50">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700">
                  Compose manually · pick segment, method, title
                </span>
                <ArrowRight size={12} className="text-ink-500 transition group-open:rotate-90" />
              </summary>
              <div className="space-y-6 border-t border-line-200 p-4">
                <StepBlock n={1} label="Pick a segment" active={currentStep === 1} done={stepDone[1]}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {segments.map((s) => {
                      const selected = s.id === segmentId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSegmentId(s.id)}
                          className={`border p-3 text-left transition ${
                            selected ? "border-ink-950 bg-paper-100" : "border-line-200 hover:border-ink-950"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Layers size={13} className="text-ink-500" />
                            <p className="truncate font-serif text-sm text-ink-950">{s.label}</p>
                          </div>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                            {s.size} personas · {s.visibility}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-ink-700">{s.prompt}</p>
                        </button>
                      );
                    })}
                  </div>
                </StepBlock>

                <StepBlock
                  n={2}
                  label="Choose the method"
                  active={currentStep === 2}
                  done={stepDone[2]}
                  locked={!stepDone[1]}
                  sectionRef={step2Ref}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {METHODS.map((m) => {
                      const selected = m.id === kind;
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setKind(m.id)}
                          disabled={!stepDone[1]}
                          className={`flex flex-col border p-3 text-left transition disabled:opacity-40 ${
                            selected ? "border-ink-950 bg-paper-100" : "border-line-200 hover:border-ink-950"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={14} className="text-ink-950" />
                            <p className="font-serif text-sm text-ink-950">{m.label}</p>
                          </div>
                          <p className="mt-2 text-[11px] leading-snug text-ink-700">{m.produces}</p>
                          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                            {m.duration}
                          </p>
                          <p className="mt-1 text-[10px] leading-snug text-ink-500">
                            Best for: {m.bestFor}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </StepBlock>

                <StepBlock
                  n={3}
                  label="Frame the question"
                  active={currentStep === 3}
                  done={stepDone[3]}
                  locked={!stepDone[2]}
                  sectionRef={step3Ref}
                >
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                      Working title
                    </span>
                    <input
                      ref={titleInputRef}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!stepDone[2]}
                      placeholder="e.g. CBI wind-down perception test"
                      className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-2 text-sm focus:border-ink-950 focus:outline-none disabled:opacity-40"
                    />
                  </label>

                  <label className="mt-3 block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                      Objective <span className="text-ink-400">(optional but recommended)</span>
                    </span>
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      disabled={!stepDone[2]}
                      rows={2}
                      placeholder="What decision does this study inform?"
                      className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-2 text-sm focus:border-ink-950 focus:outline-none disabled:opacity-40"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {OBJECTIVE_EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setObjective((v) => (v ? `${v}. ${ex}` : ex))}
                        disabled={!stepDone[2]}
                        className="border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 hover:border-ink-950 hover:text-ink-950 disabled:opacity-40"
                      >
                        + {ex}
                      </button>
                    ))}
                  </div>
                </StepBlock>
              </div>
            </details>
          </div>


          {/* Sticky preview */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="border border-line-200 bg-paper-0 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Study preview
                </p>
                {!ready ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700">
                    Next: {nextLabel} <ArrowRight size={10} />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-600">
                    <Check size={11} strokeWidth={2.5} /> Ready to create
                  </span>
                )}
              </div>
              <p className="mt-2 font-serif text-lg leading-tight text-ink-950">
                {title.trim() || <span className="text-ink-400">Untitled study</span>}
              </p>
              <dl className="mt-3 space-y-2 text-[12px]">
                <PreviewRow label="Segment" value={chosenSegment ? `${chosenSegment.label} · ${chosenSegment.size} personas` : "—"} />
                <PreviewRow label="Method" value={chosenMethod?.label ?? "—"} />
                <PreviewRow label="Objective" value={objective.trim() || "—"} />
              </dl>
              <button
                type="button"
                onClick={() => create.mutate({})}
                disabled={!ready || create.isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
              >
                {create.isPending ? "Creating…" : "Create this study"} <ArrowRight size={12} />
              </button>
              {create.isError && (
                <p className="mt-2 text-[11px] text-rose-600">{(create.error as Error).message}</p>
              )}
            </div>
          </aside>

        </div>
      )}

      {/* Grouped library */}
      {studies.length > 0 && (
        <div className="space-y-6">
          <div className="border-t border-line-200 pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Your studies · {studies.length}
            </p>
          </div>
          <StudyGroup title="Running" studies={grouped.running} code={code} />
          <StudyGroup title="Synthesized" studies={grouped.done} code={code} />
          <StudyGroup title="Drafts" studies={grouped.drafts} code={code} />
        </div>
      )}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-950">{value}</dd>
    </div>
  );
}

function StepBlock({
  n,
  label,
  active,
  done,
  locked,
  sectionRef,
  children,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
  locked?: boolean;
  sectionRef?: React.Ref<HTMLElement>;
  children: React.ReactNode;
}) {
  const dot = done
    ? "border-ink-950 bg-ink-950 text-paper-0"
    : active
      ? "border-ink-950 bg-paper-0 text-ink-950"
      : locked
        ? "border-line-200 bg-paper-0 text-ink-400"
        : "border-line-200 bg-paper-0 text-ink-700";
  return (
    <section
      ref={sectionRef}
      className={`scroll-mt-4 border p-4 transition ${
        active ? "border-ink-950" : locked ? "border-line-200 opacity-70" : "border-line-200"
      }`}
    >

      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full border font-mono text-[11px] ${dot}`}>
          {n.toString().padStart(2, "0")}
        </span>
        <h3 className="font-serif text-lg text-ink-950">{label}</h3>
        {done && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-600">
            Done
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function StudyGroup({
  title,
  studies,
  code,
}: {
  title: string;
  studies: Awaited<ReturnType<typeof listStudies>>;
  code: string;
}) {
  if (studies.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {title} · {studies.length}
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {studies.map((s) => (
          <Link
            key={s.id}
            to="/admin/countries/$code/personas/studies/$id"
            params={{ code, id: s.id }}
            className="group flex items-start gap-3 border border-line-200 bg-paper-0 p-3 hover:border-ink-950"
          >
            <FlaskConical size={16} className="mt-0.5 text-ink-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-base text-ink-950">{s.title}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                {s.kind.replace("_", " ")} · {s.status} · {new Date(s.created_at).toLocaleDateString()}
              </p>
            </div>
            <ArrowRight
              size={14}
              className="mt-1 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-ink-950"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyStart({ code }: { code: string }) {
  return (
    <div className="grid place-items-center border border-dashed border-line-200 bg-paper-0 p-10 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center border border-line-200 text-ink-950">
          <Layers size={20} />
        </span>
        <h3 className="mt-3 font-serif text-xl text-ink-950">Start with a segment</h3>
        <p className="mt-1 text-sm text-ink-500">
          A study runs against a segment of personas. Draft your first audience in plain English — we&rsquo;ll
          generate a divergent set grounded in {code}.
        </p>
        <Link
          to="/admin/countries/$code/personas/segments"
          params={{ code }}
          className="mt-4 inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
        >
          Draft your first segment <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function AiComposerCard({
  state,
  onApprove,
  onEdit,
  onRecompose,
  isCreating,
  refetching,
}: {
  state: ComposeStudyResult | "loading" | undefined;
  onApprove: () => void;
  onEdit: () => void;
  onRecompose: () => void;
  isCreating: boolean;
  refetching: boolean;
}) {
  const isLoading = state === "loading" || !state;
  const method =
    state && state !== "loading" && state.ok
      ? METHODS.find((m) => m.id === state.kind)
      : undefined;
  return (
    <section className="border border-ink-950 bg-paper-0">
      <header className="flex items-center justify-between gap-2 border-b border-line-200 bg-paper-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-ink-950" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950">
            AI proposes your next study
          </p>
        </div>
        {refetching && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            <Loader2 size={11} className="animate-spin" /> Rethinking
          </span>
        )}
      </header>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-ink-500">
            <Loader2 size={14} className="animate-spin" />
            Grounding in this country&rsquo;s brief, segments, and prior studies…
          </div>
        ) : !state.ok ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-700">
              AI couldn&rsquo;t compose a proposal:{" "}
              <span className="text-rose-600">{state.reason}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onRecompose}
                className="inline-flex items-center gap-1.5 border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-paper-100"
              >
                <Wand2 size={11} /> Try again
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950"
              >
                Compose manually
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-serif text-xl leading-tight text-ink-950">{state.title}</p>
              <p className="mt-1 text-sm text-ink-700">{state.objective}</p>
            </div>

            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <FactCell icon={Layers} label="Segment" value={state.segmentLabel} />
              <FactCell
                icon={method?.icon ?? MessageSquare}
                label="Method"
                value={method?.label ?? state.kind}
              />
              <FactCell icon={Target} label="Duration" value={method?.duration ?? "—"} />
            </dl>

            <div className="border-l-2 border-ink-950 bg-paper-100 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Why now</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-950">{state.rationale}</p>
              {state.evidence.length > 0 && (
                <ul className="mt-2 space-y-1 text-[12px] text-ink-700">
                  {state.evidence.slice(0, 3).map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-ink-400">&ldquo;</span>
                      <span>
                        {e.quote}
                        <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                          · {e.source}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onApprove}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
              >
                {isCreating ? "Launching…" : "Approve & run synthesis"} <ArrowRight size={12} />
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950"
              >
                Edit before launching
              </button>
              <button
                type="button"
                onClick={onRecompose}
                className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950"
              >
                <Wand2 size={11} /> Propose another
              </button>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">
                {state.model}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FactCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-line-200 bg-paper-0 p-2.5">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
        <Icon size={11} className="text-ink-500" /> {label}
      </p>
      <p className="mt-1 font-serif text-sm text-ink-950">{value}</p>
    </div>
  );
}
