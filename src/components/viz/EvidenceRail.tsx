import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSectorEvidence } from "@/lib/country-viz/viz.functions";
import type { SectorTile } from "@/lib/country-viz/viz.functions";

export function EvidenceRail({ countryCode, sector }: { countryCode: string; sector: SectorTile | null }) {
  const fetchEv = useServerFn(getSectorEvidence);
  const { data, isLoading } = useQuery({
    enabled: !!sector,
    queryKey: ["viz", "evidence", countryCode, sector?.code],
    queryFn: () => fetchEv({ data: { countryCode, sectorCode: sector!.code } }),
  });

  if (!sector) {
    return (
      <div className="rounded border border-dashed border-line-200 p-6 text-center text-xs text-ink-500">
        Select a sector tile or heatmap cell to see dossier evidence, ministers, and memory items.
      </div>
    );
  }

  return (
    <div className="rounded border border-line-200 bg-paper-0 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Evidence Rail</div>
          <h3 className="font-serif text-lg">{sector.label} <span className="text-ink-500 tabular-nums text-sm">· {sector.share_pct.toFixed(1)}% GDP</span></h3>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Ministers on portfolio</div>
        {sector.ministers.length === 0 && <p className="text-xs text-ink-500 italic">No ministry mapped to this sector.</p>}
        <div className="flex flex-wrap gap-2">
          {sector.ministers.map((m) => (
            <div key={m.ministry_slug} className="rounded border border-line-200 px-2 py-1 text-[11px]">
              <span className="font-medium">{m.ministry_name}</span>
              {m.minister && <span className="text-ink-500"> · {m.minister}</span>}
              <span className="ml-1 font-mono text-[9px] text-ink-500 tabular-nums">w={m.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Dossiers</div>
        {isLoading && <p className="text-xs text-ink-500">Loading…</p>}
        {!isLoading && (data?.dossiers?.length ?? 0) === 0 && <p className="text-xs text-ink-500 italic">No dossier committed yet.</p>}
        <ul className="space-y-1 text-xs">
          {(data?.dossiers ?? []).slice(0, 5).map((d: any, idx: number) => (
            <li key={idx} className="rounded border border-line-200 p-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-500">{d.kind}</span>
              <div className="line-clamp-3 text-ink-950">{extractSummary(d.payload)}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Second-brain memory</div>
        {!isLoading && (data?.memory?.length ?? 0) === 0 && <p className="text-xs text-ink-500 italic">No memory hits.</p>}
        <ul className="space-y-1 text-xs">
          {(data?.memory ?? []).slice(0, 5).map((m: any, idx: number) => (
            <li key={idx} className="rounded border border-line-200 p-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-500">{m.kind}</span>
              {m.title && <div className="font-medium text-ink-950">{m.title}</div>}
              <div className="line-clamp-2 text-ink-500">{m.content}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function extractSummary(payload: any): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.narrative === "string") return payload.narrative;
  if (Array.isArray(payload.programmes) && payload.programmes.length) {
    return payload.programmes.slice(0, 2).map((p: any) => p.name ?? p.title ?? "").filter(Boolean).join(" · ");
  }
  // Human-readable fallback — never expose raw JSON in the UI.
  const firstStr = Object.values(payload).find((v) => typeof v === "string" && (v as string).trim().length > 0);
  return typeof firstStr === "string" ? (firstStr as string).slice(0, 200) : "(structured payload)";
}
