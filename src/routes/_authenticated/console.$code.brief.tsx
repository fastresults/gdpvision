import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import {
  ExecutiveDashboard,
  ExecutiveSkeleton,
} from "@/components/executive/ExecutiveDashboard";

export const Route = createFileRoute("/_authenticated/console/$code/brief")({
  head: ({ params }) => ({
    meta: [
      { title: `Morning Brief · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `The Principal's morning brief: today's decisions and the standing of all eight chambers for ${params.code}.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-[var(--signal-negative)]">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-ink-500">No country on record.</div>,
  component: BriefRoute,
});

function BriefRoute() {
  const { code } = Route.useParams();
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 safe-bottom">
      <Suspense fallback={<ExecutiveSkeleton />}>
        <ExecutiveDashboard code={code} />
      </Suspense>
    </div>
  );
}
