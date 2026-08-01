// Chamber 07 · Stage 04 · Fieldwork.
//
// The field desk. The approved plan already says what must be fielded, to whom
// and at what size, so this stage does not ask the admin to invent the work: it
// lays the plan out as an ordered ladder of waves, each with its own state and
// its own single next move, and refuses to call the stage done until every wave
// the plan obliges has actually closed.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2 } from "lucide-react";

import { CollectionWave } from "./fieldwork/CollectionWave";
import { SessionWave } from "./fieldwork/SessionWave";
import { EmptyAction } from "./StageFrame";
import { ShowTheDetail, StageWizard } from "./StageWizard";

import { Explain } from "@/components/explain/Explain";
import { getFieldworkBoard } from "@/lib/personas/fieldwork.functions";
import { cn } from "@/lib/utils";

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
    queryFn: () => getFieldworkBoard({ data: { projectId, studyId: studyId as string } }),
    enabled: !!studyId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["fieldwork-board", projectId, studyId] });
    onChanged();
  };

  const board = boardQ.data ?? null;
  const waves = board?.waves ?? [];
  const outstanding = waves.find((w) => w.status !== "complete");

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

  const renderWave = (state: (typeof waves)[number], i: number) => (
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
        <SessionWave index={i + 1} state={state} board={board} studyId={studyId} refresh={refresh} />
      )}
    </div>
  );

  const ladder = (
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
          Mail is not connected, so invitations are prepared in the comms log with their participant
          links rather than sent. Copy a link to reach anyone directly.
        </p>
      ) : null}
      <ol className="mt-3 divide-y divide-line-200 border-t border-line-200">
        {waves.map((s, i) => (
          <li key={s.wave.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-[13px] text-ink-900">
              <span className="font-mono text-[10px] tracking-[0.16em] text-ink-500">
                {String(i + 1).padStart(2, "0")}
              </span>{" "}
              {s.wave.title}
            </span>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.16em]",
                s.status === "complete" ? "text-emerald-700" : "text-ink-500",
              )}
            >
              {s.status === "complete" ? "closed" : s.next}
            </span>
          </li>
        ))}
      </ol>
    </header>
  );

  const open = waves.filter((w) => w.status !== "complete");
  const collections = waves.filter((w) => w.wave.kind === "collection");

  return (
    <StageWizard
      actions={{
        readout: {
          instruction:
            "Read the ladder the approved plan obliges, then start at the first open wave.",
          outstanding: waves.length === 0 ? "the plan obliges no waves" : null,
          doneNote: `${waves.length} wave${waves.length === 1 ? "" : "s"} on the ladder`,
        },
        waves: {
          instruction: outstanding
            ? `Work wave ${waves.indexOf(outstanding) + 1} — ${outstanding.wave.title}.`
            : "Every wave the plan obliged has closed.",
          outstanding: outstanding
            ? `${open.length} wave${open.length === 1 ? "" : "s"} still open · ${outstanding.next}`
            : null,
          doneNote: `${done} of ${waves.length} waves closed`,
          action: outstanding
            ? {
                label: "Take me to the open wave",
                onClick: () =>
                  document
                    .getElementById(`wave-${outstanding.wave.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                icon: <ArrowDown size={12} />,
                note: "Scrolls to the one wave that still needs you.",
              }
            : null,
        },
        returns: {
          instruction: "Check what came back before the field is closed.",
          outstanding:
            open.length > 0
              ? `${open.length} wave${open.length === 1 ? "" : "s"} still open`
              : null,
          doneNote: "Returns are in and every wave has closed",
        },
      }}
      panels={{
        // Read the ladder before touching it.
        readout: ladder,

        // One wave at a time — the outstanding one first.
        waves: (
          <div className="space-y-5">
            {open.length === 0 ? (
              <EmptyAction
                title="Every wave is closed"
                body="Nothing is left in the field. Move on to the returns and then close the stage."
              />
            ) : (
              renderWave(open[0]!, waves.indexOf(open[0]!))
            )}
            {open.length > 1 || done > 0 ? (
              <ShowTheDetail
                label={`Show the other waves · ${waves.length - (open.length > 0 ? 1 : 0)}`}
              >
                <div className="space-y-5">
                  {waves
                    .filter((s) => s !== open[0])
                    .map((s) => renderWave(s, waves.indexOf(s)))}
                </div>
              </ShowTheDetail>
            ) : null}
          </div>
        ),


        // Returns land against collection waves, and this is the closing test.
        returns: (
          <div className="space-y-5">
            {open.length > 0 ? (
              <p className="border border-amber-500/40 bg-amber-500/5 p-3 text-[13px] text-ink-800">
                {open.length} wave{open.length === 1 ? "" : "s"} still open. The field cannot be
                closed until each one reaches its target or is stood down.
              </p>
            ) : (
              <p className="border border-emerald-500/40 bg-emerald-500/5 p-3 text-[13px] text-ink-800">
                Every wave the plan obliged has closed. The evidence stage can now read the field.
              </p>
            )}
            {collections.length === 0 ? (
              <EmptyAction
                title="No survey returns to chase"
                body="This programme's plan is sessions only. Continue to close the field."
              />
            ) : (
              collections.map((s) => renderWave(s, waves.indexOf(s)))
            )}
          </div>
        ),

      }}
    />
  );
}

