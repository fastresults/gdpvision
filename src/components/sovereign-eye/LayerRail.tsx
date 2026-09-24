import { Activity, Brain, ChevronLeft, ChevronRight, CloudSun, Eye, EyeOff, Landmark, Layers, Waves } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Explain } from "@/components/explain/Explain";
import type { SovereignEyeLayer } from "@/lib/sovereign-eye.functions";

const ICONS = { macro: Activity, sector: Layers, capital: Waves, ministry: Landmark, corpus: Brain, live: CloudSun };

export function LayerRail({ layers, focusedLayerId, visibleIds, aiSelectedIds, collapsed, onCollapse, onFocus, onToggleVisible, onToggleAi, onShowAll, onClear }: {
  layers: SovereignEyeLayer[];
  focusedLayerId: string;
  visibleIds: string[];
  aiSelectedIds: string[];
  collapsed: boolean;
  onCollapse: () => void;
  onFocus: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleAi: (id: string) => void;
  onShowAll: () => void;
  onClear: () => void;
}) {
  if (collapsed) {
    return (
      <section className="flex min-h-14 items-center justify-between border border-line-200 bg-card xl:min-h-[620px] xl:flex-col xl:py-3" aria-label="Map layers tray">
        <button type="button" className="btn-ghost h-10 w-10 border-0 p-0" onClick={onCollapse} aria-label="Expand map layers tray"><ChevronRight size={16} aria-hidden /></button>
        <div className="flex items-center gap-2 px-2 xl:flex-col"><Layers size={17} className="text-ink-700" aria-hidden /><span className="font-mono text-[10px] text-ink-700" data-numeric>{visibleIds.length}/{layers.length}</span></div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500 [writing-mode:vertical-rl] xl:block">Layers</span>
      </section>
    );
  }

  return (
    <section className="border border-line-200 bg-card" aria-label="Map layers">
      <div className="border-b border-line-200 px-5 py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Map layers</p>
            <h2 className="mt-1 font-serif text-2xl text-ink-950">Choose what is visible</h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">{visibleIds.length} of {layers.length} shown</span>
          <button type="button" className="btn-ghost h-9 w-9 shrink-0 p-0" onClick={onCollapse} aria-label="Collapse map layers tray"><ChevronLeft size={16} aria-hidden /></button>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onShowAll} className="btn-secondary min-h-9 px-3 text-[11px]">
            <Eye size={14} strokeWidth={1.5} /> Show all
          </button>
          <button type="button" onClick={onClear} className="btn-ghost min-h-9 px-3 text-[11px]">
            <EyeOff size={14} strokeWidth={1.5} /> Clear map
          </button>
        </div>
      </div>
      <div className="divide-y divide-line-200">
        {layers.map((layer) => {
          const Icon = ICONS[layer.kind];
          const focused = focusedLayerId === layer.id;
          const visible = visibleIds.includes(layer.id);
          const inBrief = aiSelectedIds.includes(layer.id);
          return (
            <div key={layer.id} className={focused ? "bg-paper-100" : "bg-paper-0"}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4">
                <button type="button" onClick={() => onFocus(layer.id)} className="btn-ghost h-10 w-10 p-0" aria-label={`Inspect ${layer.label}`} aria-current={focused ? "true" : undefined}>
                  <Icon size={17} strokeWidth={1.5} />
                </button>
                <button type="button" onClick={() => onFocus(layer.id)} className="btn-ghost min-w-0 justify-start border-0 p-0 text-left">
                  <span className="min-w-0">
                    <span className="block font-serif text-lg leading-tight text-ink-950">{layer.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-500">{layer.narrative}</span>
                  </span>
                </button>
                <div className="text-right">
                  <Switch checked={visible} onCheckedChange={() => onToggleVisible(layer.id)} aria-label={`${visible ? "Hide" : "Show"} ${layer.label}`} />
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">{visible ? "On" : "Off"}</span>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                <div className="h-1.5 bg-line-100" aria-hidden="true"><div className="h-full bg-ink-950 transition-all" style={{ width: `${Math.max(4, layer.strength ?? 0)}%` }} /></div>
                <Explain id="sovereign-eye.layer-strength" mark={false}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700" data-numeric>{layer.strength == null ? "n/a" : layer.strength.toFixed(2)}</span>
                </Explain>
                <label className="col-span-2 flex cursor-pointer items-center gap-2 text-xs text-ink-600">
                  <Checkbox checked={inBrief} onCheckedChange={() => onToggleAi(layer.id)} aria-label={`Use ${layer.label} in AI brief`} />
                  Use in AI brief
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">{layer.status}</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
