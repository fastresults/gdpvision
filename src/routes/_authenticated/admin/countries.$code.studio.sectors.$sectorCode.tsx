import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { listStudioContext } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { SectorDossierDrawer } from "@/components/sector/SectorDossierDrawer";
import { useState } from "react";

function ctxQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-ctx", code],
    queryFn: () => listStudioContext({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/studio/sectors/$sectorCode")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(ctxQuery(params.code));
  },
  errorComponent: ({ error }) => <p className="text-sm text-red-600">{error.message}</p>,
  component: SectorTransitionPage,
});

function SectorTransitionPage() {
  const { code, sectorCode } = Route.useParams();
  const { data: ctx } = useSuspenseQuery(ctxQuery(code));
  const [dossierOpen, setDossierOpen] = useState(true);
  const sector = ctx.sectors.find((s) => s.code === sectorCode);
  const idx = ctx.sectors.findIndex((s) => s.code === sectorCode);
  const color = sectorColor(sector?.hue_token, Math.max(0, idx));

  if (!sector) {
    return (
      <div className="space-y-4">
        <Link to="/admin/countries/$code/studio" params={{ code }} className="btn-ghost inline-flex items-center gap-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Macro Board
        </Link>
        <p className="text-sm text-ink-500">Sector {sectorCode} not found for this country.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/countries/$code/studio" params={{ code }} className="btn-ghost inline-flex items-center gap-2">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Macro Board
      </Link>
      <header className="border-b border-line-200 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
          Sector transition dossier
        </p>
        <div className="mt-3 flex items-baseline gap-4">
          <span className="inline-block h-6 w-6" style={{ background: color }} />
          <h1 className="font-serif text-3xl text-ink-950">{sector.label}</h1>
          <span className="font-mono text-sm text-ink-500">{sector.share_pct.toFixed(1)}% of GDP</span>
        </div>
      </header>

      <SectorDossierDrawer
        countryCode={code}
        sectorCode={dossierOpen ? sectorCode : null}
        onClose={() => setDossierOpen(false)}
      />

      {!dossierOpen && (
        <button className="btn-primary" onClick={() => setDossierOpen(true)}>
          Reopen dossier
        </button>
      )}
    </div>
  );
}
