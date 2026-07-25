import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { ThreatComposer } from "@/components/studio/ThreatComposer";
import { ThreatStepper } from "@/components/studio/ThreatStepper";
import { listStudioContext } from "@/lib/fdi-resilience.functions";

function ctxQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-ctx", code],
    queryFn: () => listStudioContext({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/studio/threats/new")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(ctxQuery(params.code));
  },
  errorComponent: ({ error }) => <p className="text-sm text-red-600">{error.message}</p>,
  component: ThreatComposerPage,
});

function ThreatComposerPage() {
  const { code } = Route.useParams();
  const { data: ctx } = useSuspenseQuery(ctxQuery(code));
  return (
    <div className="space-y-6">
      <ThreatStepper active="threat" disabled={{ strategy: true, stress: true }} />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Act 1 · Name the threat
        </p>
        <h2 className="mt-1 font-serif text-3xl text-ink-950">What is the shock?</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-700">
          Frame a plausible disruption to one or more sectors. We&rsquo;ll ground the framing in the country&rsquo;s current GDP composition and produce a resilient FDI strategy you can stress-test.
        </p>
      </div>
      <ThreatComposer code={code} sectors={ctx.sectors} />
    </div>
  );
}
