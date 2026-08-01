// Chamber 07 · Stage 04 · Fieldwork.
//
// The field desk. The approved plan already says what must be fielded, to whom
// and at what size, so this stage does not ask the admin to invent the work: it
// lays the plan out as an ordered ladder of waves, each with its own state and
// its own single next move, and refuses to call the stage done until every wave
// the plan obliges has actually closed.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { CollectionWave } from "./fieldwork/CollectionWave";
import { SessionWave } from "./fieldwork/SessionWave";
import { EmptyAction } from "./StageFrame";
import { useResolveAction } from "./stage-bus";

import { Explain } from "@/components/explain/Explain";
import { getFieldworkBoard } from "@/lib/personas/fieldwork.functions";

export function FieldworkStage({
  projectId,
  studyId,
  onChanged,
}: {
  code: string;
  projectId: string;
  studyId: string | null;
  onChanged: () => void;
}) {
  const qc = useQueryClient();

  const boardQ = useQuery({
    queryKey: ["fieldwork-board", projectId, studyId],
    queryFn: () =>
      getFieldworkBoard({ data: { projectId, studyId: studyId as string } }),
    enabled: !!studyId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["fieldwork-board", projectId, studyId] });
    onChanged();
  };

  const board = boardQ.data ?? null;
  const waves = board?.waves ?? [];
  const outstanding = waves.find((w) => w.status !== "complete");

  useResolveAction(
    "fieldwork",
    outstanding
      ? {
          label: outstanding.next,
          run: () => {
            document
              .getElementById(`wave-${outstanding.wave.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          pending: false,
        }
      : null,
  );

  if (!studyId) {
    return (
      <EmptyAction
        title="No programme yet"
        body="Fieldwork opens once the programme has a brief and an approved plan."
      />
    );
  }

  if (boardQ.isLoading) {
    return (
      <p className="flex items-center gap-2 p-6 text-[13px] text-ink-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading the plan and the field.
      </p>
    );
  }

  if (boardQ.isError) {
    return (
      <EmptyAction
        title="The field desk could not be read"
        body="Something went wrong loading this programme's waves."
        action={
          <button type="button" className="btn-secondary" onClick={() => void boardQ.refetch()}>
            Try again
          </button>
        }
      />

    );
  }

  if (!board || waves.length === 0) {
    return (
      <EmptyAction
        title="The plan does not oblige any fieldwork"
        body="No survey or session line was found in the approved method mix. Go back to the Programme plan and add the lines you intend to field."
      />
    );
  }

  const done = waves.filter((w) => w.status === "complete").length;

  return (
    <div className="space-y-5">
      <header className="border border-line-200 bg-paper-50 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Fielding ladder
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-800">
          <Explain id="research.fieldwork.waves">
            {done} of {waves.length} wave{waves.length === 1 ? "" : "s"} complete
          </Explain>{" "}
          — each wave below is one piece of work the approved plan obliges. Work them in order; the
          stage closes when the last one does.
        </p>
        {!board.mailConfigured ? (
          <p className="mt-2 text-[12px] text-ink-600">
            Mail is not connected, so invitations are prepared in the comms log with their
            participant links rather than sent. Copy a link to reach anyone directly.
          </p>
        ) : null}
      </header>

      {waves.map((state, i) => (
        <div key={state.wave.id} id={`wave-${state.wave.id}`}>
          {state.wave.kind === "collection" ? (
            <CollectionWave
              index={i + 1}
              state={state}
              board={board}
              projectId={projectId}
              studyId={studyId}
              refresh={refresh}
            />
          ) : (
            <SessionWave
              index={i + 1}
              state={state}
              board={board}
              studyId={studyId}
              refresh={refresh}
            />
          )}
        </div>
      ))}
    </div>
  );
}
