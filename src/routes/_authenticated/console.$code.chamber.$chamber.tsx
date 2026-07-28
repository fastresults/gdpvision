// The Chamber Room Sheet, console surface. One screen between the brief and
// the working chamber: macro numbers, tempo, what awaits, the paper trail.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ExecutiveDashboard, executiveQuery } from "@/components/executive/ExecutiveDashboard";
import { ChamberSheet } from "@/components/executive/chamber/ChamberSheet";
import { indexForSlug } from "@/lib/executive/chambers";

export const Route = createFileRoute("/_authenticated/console/$code/chamber/$chamber")({
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
    <div className="border border-line-200 p-6 text-sm text-[var(--signal-negative)]">{error.message}</div>
  ),
  notFoundComponent: () => (
    <p className="border border-line-200 p-6 text-sm text-ink-500">No chamber on record under that name.</p>
  ),
  component: SheetPage,
});

function SheetPage() {
  const { code, chamber } = Route.useParams();
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <SheetBody code={code} slug={chamber} />
    </Suspense>
  );
}

function SheetBody({ code, slug }: { code: string; slug: string }) {
  const index = indexForSlug(slug);
  if (!index) throw notFound();
  const { data } = useSuspenseQuery(executiveQuery(code));
  const found = data.chambers.find((c) => c.index === index);
  if (!found) throw notFound();
  return <ChamberSheet code={code} chamber={found} surface="console" />;
}

export function SheetSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-24 border-b border-line-200" />
      <div className="h-32 border-y border-line-200" />
      <div className="h-40 border-b border-line-200" />
    </div>
  );
}

// Keeps the dashboard module in the same chunk as the sheet — the Principal
// almost always arrives here from the brief.
void ExecutiveDashboard;
