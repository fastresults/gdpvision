import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { FlaskConical, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { listSegments } from "@/lib/personas/generate.functions";
import { createStudy, listStudies } from "@/lib/personas/study.functions";

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

function StudiesPage() {
  const { code } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: studies } = useSuspenseQuery(studiesQuery(code));
  const { data: segments } = useSuspenseQuery(segmentsQuery(code));

  const [segmentId, setSegmentId] = useState<string>(search.segmentId ?? segments[0]?.id ?? "");
  const [kind, setKind] = useState<"survey" | "focus_group" | "creative_test">("survey");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createStudy({
        data: { countryCode: code, segmentId, kind, title: title.trim(), objective: objective.trim() || undefined },
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["studies", code] });
      navigate({ to: "/admin/countries/$code/personas/studies/$id", params: { code, id: row.id } });
    },
  });

  const KINDS = [
    { id: "survey" as const, label: "Survey", blurb: "Structured questions across every persona" },
    { id: "focus_group" as const, label: "Focus group", blurb: "Moderated discussion with disagreement" },
    { id: "creative_test" as const, label: "Creative test", blurb: "Reaction to a message, slogan, or asset" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Studies</p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">Rehearse the conversation</h2>
        <p className="mt-1 text-sm text-ink-500">Survey a segment, run a focus group, or test creative before it ships.</p>
      </header>

      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">New study</p>
        {segments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            <Link to="/admin/countries/$code/personas/segments" params={{ code }} className="underline">
              Generate a segment
            </Link>{" "}
            first — a study runs against a segment of personas.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={`border p-3 text-left transition ${
                    kind === k.id ? "border-ink-950 bg-paper-100" : "border-line-200 hover:border-ink-950"
                  }`}
                >
                  <p className="font-serif text-sm text-ink-950">{k.label}</p>
                  <p className="mt-1 text-[11px] text-ink-500">{k.blurb}</p>
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Segment</span>
              <select
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-2 text-sm"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.size} personas
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CBI wind-down perception test"
                className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Objective (optional)
              </span>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={2}
                className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={!segmentId || title.trim().length < 3 || create.isPending}
              className="mt-3 inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              <Plus size={12} /> {create.isPending ? "Creating…" : "Create study"}
            </button>
            {create.isError && (
              <p className="mt-2 text-[11px] text-rose-600">{(create.error as Error).message}</p>
            )}
          </>
        )}
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          All studies · {studies.length}
        </p>
        {studies.length === 0 ? (
          <div className="mt-2 border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
            No studies yet.
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line-200 border border-line-200 bg-paper-0">
            {studies.map((s) => (
              <li key={s.id}>
                <Link
                  to="/admin/countries/$code/personas/studies/$id"
                  params={{ code, id: s.id }}
                  className="flex items-center gap-3 p-3 hover:bg-paper-100"
                >
                  <FlaskConical size={16} className="text-ink-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-base text-ink-950">{s.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {s.kind.replace("_", " ")} · {s.status} · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
