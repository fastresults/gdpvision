import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertOctagon, ChevronRight, Pencil, ShieldCheck, Trash2 } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  deleteThreat,
  listStudioContext,
  listThreats,
  type FdiThreatRow,
} from "@/lib/fdi-resilience.functions";
import { ThreatEditorDialog } from "@/components/studio/ThreatEditorDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ctxQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-ctx", code],
    queryFn: () => listStudioContext({ data: { countryCode: code } }),
  });
}
function threatsQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-threats", code],
    queryFn: () => listThreats({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/studio")({
  head: ({ params }) => ({
    meta: [
      { title: `FDI Transition Studio · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ctxQuery(params.code)),
      context.queryClient.ensureQueryData(threatsQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-red-600">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-ink-500">Studio not found.</div>
  ),
  component: StudioLayout,
});

function StudioLayout() {
  const { code } = Route.useParams();
  const { data: threats } = useSuspenseQuery(threatsQuery(code));
  const { data: ctx } = useSuspenseQuery(ctxQuery(code));
  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Chamber 04 · FDI Transition Studio" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 border-r border-line-200 pr-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              FDI Transition Studio
            </p>
            <h1 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
              Threat in.<br />Resilient strategy out.
            </h1>
            <p className="mt-3 text-sm text-ink-700">
              A shock hits a sector. Reshape the FDI portfolio to absorb it —
              sector by sector, ministry by ministry.
            </p>
          </div>
          <Link
            to="/admin/countries/$code/studio"
            params={{ code }}
            activeOptions={{ exact: true }}
            activeProps={{ className: "border-ink-950 bg-ink-950 text-paper-0" }}
            className="flex items-center justify-between border border-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:bg-ink-950 hover:text-paper-0"
          >
            <span className="flex items-center gap-2">
              <AlertOctagon size={13} /> Macro FDI Board
            </span>
            <ChevronRight size={13} />
          </Link>
          <Link
            to="/admin/countries/$code/studio/threats/new"
            params={{ code }}
            activeProps={{ className: "border-ink-950 bg-ink-950 text-paper-0" }}
            className="flex items-center justify-between border border-line-200 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
          >
            <span className="flex items-center gap-2">
              <AlertOctagon size={13} /> Frame new threat
            </span>
            <ChevronRight size={13} />
          </Link>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Active threats
            </p>
            <ul className="mt-2 space-y-1">
              {threats.length === 0 && (
                <li className="text-xs text-ink-500">No threats framed yet.</li>
              )}
              {threats.map((t) => (
                <ThreatRow key={t.id} threat={t} code={code} sectors={ctx.sectors} />
              ))}
            </ul>
          </div>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SuperAdminShell>
  );
}

function ThreatRow({
  threat,
  code,
  sectors,
}: {
  threat: FdiThreatRow;
  code: string;
  sectors: Array<{ code: string; label: string; hue_token?: string | null; share_pct?: number }>;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };
  const deleteFn = useServerFn(deleteThreat);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const del = useMutation({
    mutationFn: async () => deleteFn({ data: { id: threat.id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["studio-threats", code] });
      setConfirmOpen(false);
      if (params.id === threat.id) {
        navigate({ to: "/admin/countries/$code/studio", params: { code } });
      }
    },
  });

  return (
    <li className="group relative">
      <Link
        to="/admin/countries/$code/studio/threats/$id"
        params={{ code, id: threat.id }}
        activeProps={{ className: "bg-paper-100 text-ink-950" }}
        className="block border border-line-200 px-3 py-2 pr-16 text-sm text-ink-700 hover:border-ink-950"
      >
        <span className="block truncate">{threat.name}</span>
        <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <ShieldCheck size={10} /> {threat.threat_type.replace(/_/g, " ")} ·{" "}
          {threat.severity_pct}%
        </span>
      </Link>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={`Edit ${threat.name}`}
          onClick={() => setEditOpen(true)}
          className="grid h-6 w-6 place-items-center rounded-sm text-ink-500 hover:bg-paper-100 hover:text-ink-950"
        >
          <Pencil size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={`Delete ${threat.name}`}
          onClick={() => setConfirmOpen(true)}
          className="grid h-6 w-6 place-items-center rounded-sm text-ink-500 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>

      {editOpen && (
        <ThreatEditorDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          threat={threat}
          sectors={sectors}
          countryCode={code}
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this threat?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes <span className="font-semibold">{threat.name}</span> and every strategy
              drafted against it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {del.error ? (
            <p className="text-sm text-red-600">{(del.error as Error).message}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                del.mutate();
              }}
              disabled={del.isPending}
              className="bg-rose-600 text-paper-0 hover:bg-rose-700"
            >
              {del.isPending ? "Deleting…" : "Delete threat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
