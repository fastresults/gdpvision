// Chamber 07 · Program-brief gate hook.
//
// Returns { loading, committed, needsIntake } for the active research
// program. Used by every stage route to render <ProgramBriefIntake />
// instead of the Cast / Group / Rehearse UI until the brief is committed.

import { useQuery } from "@tanstack/react-query";
import { getProjectBrief } from "@/lib/personas/project-brief.functions";

export function useProgramBriefGate(projectId: string | undefined) {
  const q = useQuery({
    queryKey: ["program-brief", projectId ?? "none"],
    queryFn: () => getProjectBrief({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 15_000,
  });
  const committed = !!q.data?.committed_at;
  return {
    loading: !!projectId && q.isLoading,
    committed,
    needsIntake: !!projectId && !q.isLoading && !committed,
    brief: q.data,
  };
}
