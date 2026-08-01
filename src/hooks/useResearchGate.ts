// Chamber 07 · Research gate.
//
// Extends the synthetic brief/blueprint gate with the track choice and the
// field-programme plan. Every programme answers three questions in order:
//   1. Which track? (synthetic / field / blended)
//   2. Is the brief committed?
//   3. Is the track's first artefact approved — AI blueprint (synthetic)
//      and/or the dated programme plan (field)?

import { useQuery } from "@tanstack/react-query";

import { getBlueprint } from "@/lib/personas/blueprint.functions";
import { getProjectBrief } from "@/lib/personas/project-brief.functions";
import { getProgrammePlan } from "@/lib/personas/programme-plan.functions";
import { listProjects } from "@/lib/personas/projects.functions";
import { isResearchTrack, tracksFor, type ResearchTrack } from "@/lib/personas/tracks";

export function useResearchGate(code: string, projectId: string | undefined) {
  const projectsQ = useQuery({
    queryKey: ["persona-projects", code],
    queryFn: () => listProjects({ data: { countryCode: code } }),
  });
  const project = (projectsQ.data ?? []).find((p) => p.id === projectId);
  const track: ResearchTrack = isResearchTrack(project?.track) ? project!.track : "synthetic";
  const trackChosen = !!project?.track_chosen_at;
  const rails = tracksFor(track);

  const briefQ = useQuery({
    queryKey: ["program-brief", projectId ?? "none"],
    queryFn: () => getProjectBrief({ data: { projectId: projectId! } }),
    enabled: !!projectId && trackChosen,
    staleTime: 15_000,
  });
  const committed = !!briefQ.data?.committed_at;

  const blueprintQ = useQuery({
    queryKey: ["program-blueprint", projectId ?? "none"],
    queryFn: () => getBlueprint({ data: { projectId: projectId! } }),
    enabled: !!projectId && committed && rails.synthetic,
    staleTime: 15_000,
  });
  const planQ = useQuery({
    queryKey: ["programme-plan", projectId ?? "none"],
    queryFn: () => getProgrammePlan({ data: { projectId: projectId! } }),
    enabled: !!projectId && committed && rails.field,
    staleTime: 15_000,
  });

  const blueprintCommitted = !!blueprintQ.data?.committedAt;
  const planCommitted = planQ.data?.plan?.status === "active";

  const loading =
    !!projectId &&
    (projectsQ.isLoading ||
      (trackChosen && briefQ.isLoading) ||
      (committed && rails.synthetic && blueprintQ.isLoading) ||
      (committed && rails.field && planQ.isLoading));

  return {
    loading,
    project,
    track,
    rails,
    needsTrack: !!projectId && !projectsQ.isLoading && !!project && !trackChosen,
    committed,
    needsIntake: !!projectId && trackChosen && !briefQ.isLoading && !committed,
    needsBlueprint:
      !!projectId && rails.synthetic && committed && !blueprintQ.isLoading && !blueprintCommitted,
    needsPlan: !!projectId && rails.field && committed && !planQ.isLoading && !planCommitted,
    blueprintCommitted,
    planCommitted,
    brief: briefQ.data,
    blueprint: blueprintQ.data,
    plan: planQ.data,
  };
}
