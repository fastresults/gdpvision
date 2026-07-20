import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { FlaskConical, Layers, Sparkles, Trash2, User, Users } from "lucide-react";
import { useState } from "react";

import { CitedText } from "@/components/citations/CitedText";
import { deletePersona, generatePersona, listPersonas, listSegments } from "@/lib/personas/generate.functions";
import { listStudies } from "@/lib/personas/study.functions";
import { StudyWizardModal } from "@/components/personas/StudyWizard/WizardModal";
import { SessionsHub } from "@/components/personas/StudyWizard/SessionsHub";
import { startAutorun } from "@/lib/personas/autorun.functions";
import { JourneyCard } from "@/components/personas/JourneyCard";

function personasQuery(code: string) {
  return queryOptions({
    queryKey: ["personas", code],
    queryFn: () => listPersonas({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/")({
  loader: async ({ context, params }) => context.queryClient.ensureQueryData(personasQuery(params.code)),
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: PersonasIndex,
});

function PersonasIndex() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const { data: personas } = useSuspenseQuery(personasQuery(code));
  const segmentsQ = useQuery({
    queryKey: ["persona-segments", code],
    queryFn: () => listSegments({ data: { countryCode: code } }),
  });
  const studiesQ = useQuery({
    queryKey: ["studies", code],
    queryFn: () => listStudies({ data: { countryCode: code } }),
  });
  const [brief, setBrief] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeDraftId, setResumeDraftId] = useState<string | undefined>(undefined);
  const [autorun, setAutorun] = useState(false);

  const gen = useMutation({
    mutationFn: () => generatePersona({ data: { countryCode: code, brief: brief.trim(), visibility } }),
    onSuccess: () => {
      setBrief("");
      qc.invalidateQueries({ queryKey: ["personas", code] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deletePersona({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personas", code] }),
  });

  const segCount = segmentsQ.data?.length ?? 0;
  const studyCount = studiesQ.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage 01 · Cast the room
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">Your synthetic public for {code}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Cast a public, group them into audiences, then rehearse the conversation. Pick a step below —
          or auto-run the whole study end-to-end.
        </p>
      </header>

      {/* Journey board */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Studio journey</p>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          <JourneyCard
            n={1}
            icon={Users}
            title="Cast the room"
            purpose="AI-generated synthetic citizens grounded in this country's second brain."
            count={personas.length}
            countLabel={personas.length === 1 ? "persona" : "personas"}
            cta="Generate personas"
            to="/admin/countries/$code/personas"
            params={{ code }}
            currentHere
          />
          <JourneyCard
            n={2}
            icon={Layers}
            title="Group your public"
            purpose="Coherent audiences a Cabinet can actually act on — geography, livelihood, attitude."
            count={segCount}
            countLabel={segCount === 1 ? "segment" : "segments"}
            cta={segCount === 0 ? "Draft your first segment" : "Manage segments"}
            to="/admin/countries/$code/personas/segments"
            params={{ code }}
            disabled={personas.length === 0}
            disabledHint="Cast personas first"
          />
          <JourneyCard
            n={3}
            icon={FlaskConical}
            title="Rehearse"
            purpose="Surveys, focus groups and creative tests — with cited synthesis in minutes."
            count={studyCount}
            countLabel={studyCount === 1 ? "study" : "studies"}
            cta={studyCount === 0 ? "Design your first study" : "Open studies"}
            to="/admin/countries/$code/personas/studies"
            params={{ code }}
            disabled={segCount === 0}
            disabledHint="Group a segment first"
          />
        </div>
      </section>

      <StudyWizardModal
        key={`${resumeDraftId ?? "new"}-${autorun ? "auto" : "manual"}`}
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setResumeDraftId(undefined);
          setAutorun(false);
          qc.invalidateQueries({ queryKey: ["personas", code] });
          qc.invalidateQueries({ queryKey: ["study-drafts", code] });
        }}
        countryCode={code}
        draftId={resumeDraftId}
        initialAutorun={autorun}
      />

      <SessionsHub
        countryCode={code}
        onResume={(id) => { setAutorun(false); setResumeDraftId(id); setWizardOpen(true); }}
        onStartNew={() => { setAutorun(false); setResumeDraftId(undefined); setWizardOpen(true); }}
        onAutoRun={async (id) => {
          setResumeDraftId(id);
          setAutorun(true);
          try { await startAutorun({ data: { draftId: id } }); } catch { /* console will retry */ }
          setWizardOpen(true);
        }}
      />

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Library · {personas.length} personas
        </p>
        {personas.length === 0 ? (
          <div className="mt-2 border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
            No personas yet — launch the Research Studio from the sidebar, or expand the advanced generator below.
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {personas.map((p) => (
              <div key={p.id} className="group relative border border-line-200 bg-paper-0 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center border border-line-200 text-ink-950">
                    <User size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/admin/countries/$code/personas/$id"
                      params={{ code, id: p.id }}
                      className="block truncate font-serif text-base text-ink-950 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.14em] text-ink-500">
                      {p.archetype ?? "—"} · {p.visibility}
                    </p>
                    {p.summary && (
                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-700">
                        <CitedText text={p.summary} citations={p.citations as never} />
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete ${p.name}?`)) del.mutate(p.id);
                    }}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} className="text-ink-500 hover:text-rose-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="group border border-line-200 bg-paper-0">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Advanced</p>
            <p className="mt-0.5 font-serif text-sm text-ink-950">Hand-craft a single persona</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 group-open:hidden">
            Expand
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 group-open:inline">
            Collapse
          </span>
        </summary>
        <div className="border-t border-line-200 p-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Brief</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="e.g. A European HNWI considering CBI in the Caribbean"
              className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-sm focus:border-ink-950 focus:outline-none"
            />
          </label>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-1 text-[11px] text-ink-700">
              <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Public
            </label>
            <label className="flex items-center gap-1 text-[11px] text-ink-700">
              <input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /> Private
            </label>
            <button
              type="button"
              onClick={() => gen.mutate()}
              disabled={brief.trim().length < 3 || gen.isPending}
              className="ml-auto inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              <Sparkles size={12} /> {gen.isPending ? "Generating…" : "Generate persona"}
            </button>
          </div>
          {gen.isError && <p className="mt-2 text-[11px] text-rose-600">{(gen.error as Error).message}</p>}
        </div>
      </details>

    </div>
  );
}
