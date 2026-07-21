// Chamber 07 · Program-brief + blueprint gate hook.
//
// Returns commit state for both the required Program Brief (Stage 00) and
// the AI-drafted Blueprint (Stage 01). Downstream stages (Cast / Group /
// Rehearse) remain locked until BOTH are committed.

import { useQuery } from "@tanstack/react-query";
import { getBlueprint } from "@/lib/personas/blueprint.functions";
import { getProjectBrief } from "@/lib/personas/project-brief.functions";

export function useProgramBriefGate(projectId: string | undefined) {
  const briefQ = useQuery({
    queryKey: ["program-brief", projectId ?? "none"],
    queryFn: () => getProjectBrief({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 15_000,
  });
  const blueprintQ = useQuery({
    queryKey: ["program-blueprint", projectId ?? "none"],
    queryFn: () => getBlueprint({ data: { projectId: projectId! } }),
    enabled: !!projectId && !!briefQ.data?.committed_at,
    staleTime: 15_000,
  });
  const committed = !!briefQ.data?.committed_at;
  const blueprintCommitted = !!blueprintQ.data?.committedAt;
  return {
    loading: !!projectId && (briefQ.isLoading || (committed && blueprintQ.isLoading)),
    committed,
    needsIntake: !!projectId && !briefQ.isLoading && !committed,
    needsBlueprint: !!projectId && committed && !blueprintCommitted,
    blueprintCommitted,
    brief: briefQ.data,
    blueprint: blueprintQ.data,
  };
}
