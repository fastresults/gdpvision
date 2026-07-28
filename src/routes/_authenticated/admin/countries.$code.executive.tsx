import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  ExecutiveDashboard,
  ExecutiveSkeleton,
} from "@/components/executive/ExecutiveDashboard";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/executive")({
  head: ({ params }) => ({
    meta: [
      { title: `Executive Brief · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `One screen for the Principal: what requires a decision today, and the state of all eight chambers for ${params.code}.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="grid min-h-dvh place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-[var(--signal-negative)]">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-paper-0 p-8">
      <p className="text-sm text-ink-500">No country on record for this code.</p>
    </div>
  ),
  component: ExecutiveRoute,
});

function ExecutiveRoute() {
  const { code } = Route.useParams();
  return (
    <SuperAdminShell>
      <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8">
        <Suspense fallback={<ExecutiveSkeleton />}>
          <ExecutiveDashboard code={code} surface="admin" />
        </Suspense>
      </div>
    </SuperAdminShell>
  );
}
