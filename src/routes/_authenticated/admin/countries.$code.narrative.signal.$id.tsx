import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";

import { getSignal, listArtifactsForSignal } from "@/lib/narrative-chamber.functions";
import { NarrativeJourney } from "@/components/narrative/NarrativeJourney";
import { DayClock } from "@/components/narrative/DayClock";
import { DossierCard } from "@/components/narrative/DossierCard";
import { StrategyPanel } from "@/components/narrative/StrategyPanel";
import { DraftStudio } from "@/components/narrative/DraftStudio";
import { LineageChevron } from "@/components/narrative/LineageChevron";
import { PriorityPill } from "@/components/narrative/PriorityPill";

function signalQuery(id: string) {
  return queryOptions({
    queryKey: ["narrative-signal", id],
    queryFn: () => getSignal({ data: { id } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/narrative/signal/$id")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(signalQuery(params.id));
  },
  errorComponent: ({ error }) => <p className="text-sm text-rose-600">{error.message}</p>,
  notFoundComponent: () => <p className="text-sm text-ink-500">Signal not found.</p>,
  component: SignalWorkspace,
});

function SignalWorkspace() {
  const { id } = Route.useParams();
  const { data: signal } = useSuspenseQuery(signalQuery(id));

  const artifacts = useQuery({
    queryKey: ["narrative-artifacts", id],
    queryFn: () => listArtifactsForSignal({ data: { signalId: id } }),
  });

  const hasStrategy = (artifacts.data?.strategies?.length ?? 0) > 0;
  const hasComms = (artifacts.data?.comms?.length ?? 0) > 0;
  const hasPublished = (artifacts.data?.comms ?? []).some((c) => !!c.released_at);

  return (
    <div className="space-y-6">
      <NarrativeJourney
        active={hasPublished ? "publish" : hasComms ? "publish" : hasStrategy ? "publish" : "triage"}
        steps={[
          { key: "monitor", title: "① Monitor", caption: "Ingested", done: true },
          { key: "triage", title: "② Triage", caption: "Dossier", done: !!signal.recommendation },
          { key: "position", title: "③ Position", caption: "Strategy", done: hasStrategy },
          { key: "publish", title: "④ Publish", caption: "Drafts + ship", done: hasPublished },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LineageChevron
          hasSignal
          hasDossier={!!signal.recommendation}
          hasStrategy={hasStrategy}
          hasComms={hasComms}
          hasPublished={hasPublished}
        />
        <DayClock startedAt={signal.created_at} />
      </div>

      <DossierCard signal={signal} code={signal.scope_key} />

      <StrategyPanel signalId={id} />

      <DraftStudio signalId={id} />
    </div>
  );
}
