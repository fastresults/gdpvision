// The Chamber Room Sheet, agency surface. Same sheet as the console, inside
// the super-admin shell.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { executiveQuery, ExecutiveSkeleton } from "@/components/executive/ExecutiveDashboard";
import { ChamberSheet } from "@/components/executive/chamber/ChamberSheet";
import { indexForSlug } from "@/lib/executive/chambers";

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/executive/chamber/$chamber",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Chamber sheet · ${params.chamber} · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Macro and micro standing of the ${params.chamber} chamber for ${params.code} before entering it.`,
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
      <p className="text-sm text-ink-500">No chamber on record under that name.</p>
    </div>
  ),
  component: AdminSheetRoute,
});

function AdminSheetRoute() {
  const { code, chamber } = Route.useParams();
  return (
    <SuperAdminShell>
      <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8">
        <Suspense fallback={<ExecutiveSkeleton />}>
          <AdminSheetBody code={code} slug={chamber} />
        </Suspense>
      </div>
    </SuperAdminShell>
  );
}

function AdminSheetBody({ code, slug }: { code: string; slug: string }) {
  const index = indexForSlug(slug);
  if (!index) throw notFound();
  const { data } = useSuspenseQuery(executiveQuery(code));
  const found = data.chambers.find((c) => c.index === index);
  if (!found) throw notFound();
  return <ChamberSheet code={code} chamber={found} surface="admin" />;
}
