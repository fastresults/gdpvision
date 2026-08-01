// Chamber 07 · Field stage 00 — the brief.
//
// The brief is a rail stage like any other, not a door you walk back through.
// Before commit it is the intake. After commit it is the amendment surface for
// the question of record: same editor, hydrated with what is on file, with the
// commit date stated so nobody mistakes an edit for a first pass.

import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { ProgramBriefIntake } from "@/components/personas/StudyWizard/ProgramBriefIntake";
import { getProjectBrief } from "@/lib/personas/project-brief.functions";
import { StageWizard } from "./StageWizard";

export function BriefStage({
  code,
  projectId,
  committed,
  onChanged,
}: {
  code: string;
  projectId: string;
  committed: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const briefQ = useQuery({
    queryKey: ["program-brief", projectId],
    queryFn: () => getProjectBrief({ data: { projectId } }),
  });

  const committedAt = (briefQ.data as { brief_committed_at?: string | null } | undefined)
    ?.brief_committed_at;
  const stamp = committedAt
    ? new Date(committedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <StageWizard
      panels={{
        commit: (
          <div className="space-y-5">
            {committed ? (
              <p className="border border-emerald-500/40 bg-emerald-500/5 p-3 text-[13px] text-ink-800">
                {stamp
                  ? `Committed on ${stamp}. This is the question of record.`
                  : "Committed. This is the question of record."}{" "}
                Editing it here amends the brief in place — the programme, the panel and the
                instruments were all derived from it, so re-read them after a material change.
              </p>
            ) : null}
            <ProgramBriefIntake
              code={code}
              projectId={projectId}
              onCommitted={() => {
                void qc.invalidateQueries({ queryKey: ["program-brief", projectId] });
                void qc.invalidateQueries({ queryKey: ["programme-plan", projectId] });
                onChanged();
              }}
            />
          </div>
        ),
      }}
    />
  );
}
