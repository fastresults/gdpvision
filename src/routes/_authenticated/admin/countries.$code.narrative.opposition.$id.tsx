import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getOppositionItem } from "@/lib/narrative/opposition-intake.functions";
import { OppositionDetail } from "@/components/narrative/opposition/OppositionDetail";

function itemQuery(id: string) {
  return queryOptions({
    queryKey: ["opposition-item", id],
    queryFn: () => getOppositionItem({ data: { id } }),
  });
}

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/narrative/opposition/$id",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Opposition intake · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(itemQuery(params.id));
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-rose-600">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-ink-500">Intake not found.</div>
  ),
  component: OppositionDetailPage,
});

function OppositionDetailPage() {
  const { code, id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery(id));
  return (
    <OppositionDetail
      item={data.item}
      plan={data.plan}
      signedUrl={data.signedUrl}
      code={code}
    />
  );
}
