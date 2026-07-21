import { createFileRoute, Link, useSearch, Navigate } from "@tanstack/react-router";

import { StudioStepper } from "@/components/personas/StudioStepper";
import { BlueprintReview } from "@/components/personas/StudyWizard/BlueprintReview";
import { ProgramBriefIntake } from "@/components/personas/StudyWizard/ProgramBriefIntake";
import { useProgramBriefGate } from "@/hooks/useProgramBriefGate";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/blueprint")({
  component: BlueprintPage,
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
});

function BlueprintPage() {
  const { code } = Route.useParams();
  const search = useSearch({ strict: false }) as { project?: string };
  const projectId = typeof search.project === "string" && search.project.length > 0 ? search.project : undefined;

  if (!projectId) {
    return (
      <Navigate
        to="/admin/countries/$code/personas"
        params={{ code }}
      />
    );
  }

  const gate = useProgramBriefGate(projectId);

  return (
    <div className="space-y-6">
      <StudioStepper
        code={code}
        active="blueprint"
        activeProjectId={projectId}
        briefCommitted={gate.committed}
        blueprintCommitted={gate.blueprintCommitted}
      />
      <div>
        <Link
          to="/admin/countries/$code/personas"
          params={{ code }}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
        >
          ← All programs
        </Link>
      </div>
      {gate.needsIntake ? (
        <ProgramBriefIntake code={code} projectId={projectId} />
      ) : (
        <BlueprintReview code={code} projectId={projectId} />
      )}
    </div>
  );
}
