import { Activity, Brain, CloudSun, Landmark, Layers, Waves } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import type { SovereignEyeLayer } from "@/lib/sovereign-eye.functions";

const ICONS = {
  macro: Activity,
  sector: Layers,
  capital: Waves,
  ministry: Landmark,
  corpus: Brain,
  live: CloudSun,
};

export function LayerRail({
  layers,
  activeLayerId,
  selectedIds,
  onActive,
  onToggle,
}: {
  layers: SovereignEyeLayer[];
  activeLayerId: string;
  selectedIds: string[];
  onActive: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="border border-line-200 bg-card">
      <div className="border-b border-line-200 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Layer rail</p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">What the map is reading</h2>
      </div>
      <div className="divide-y divide-line-200">
        {layers.map((layer) => {
          const Icon = ICONS[layer.kind];
          const active = activeLayerId === layer.id;
          const selected = selectedIds.includes(layer.id);
          return (
            <div key={layer.id} className={active ? "bg-paper-100" : "bg-paper-0"}>
              <button
                type="button"
                onClick={() => onActive(layer.id)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left hover:bg-paper-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <span className="grid h-9 w-9 place-items-center border border-line-200 bg-paper-0 text-ink-700">
                  <Icon size={16} strokeWidth={1.5} />
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg leading-tight text-ink-950">{layer.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink-500">{layer.narrative}</span>
                </span>
                <span className="text-right font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  {layer.status}
                </span>
              </button>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pb-4">
                <div className="h-1.5 bg-line-100">
                  <div
                    className="h-full bg-ink-950 transition-all"
                    style={{ width: `${Math.max(4, layer.strength ?? 0)}%` }}
                  />
                </div>
                <Explain id="sovereign-eye.layer-strength" mark={false}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700" data-numeric>
                    {layer.strength == null ? "n/a" : `${layer.strength.toFixed(2)}`}
                  </span>
                </Explain>
                <button
                  type="button"
                  onClick={() => onToggle(layer.id)}
                  aria-pressed={selected}
                  className={`${selected ? "btn-primary" : "btn-secondary"} col-span-2 min-h-9 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]`}
                >
                  {selected ? "Selected for AI" : "Add to AI brief"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}