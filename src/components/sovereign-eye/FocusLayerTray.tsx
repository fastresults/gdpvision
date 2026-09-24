import { ChevronLeft, ChevronRight, Crosshair, Radio } from "lucide-react";

import type { SovereignEyeLayer } from "@/lib/sovereign-eye.functions";

import { InterpretationPanel } from "./InterpretationPanel";
import type { MapFeature } from "./RegionMap";

export function FocusLayerTray({ layer, pinnedFeature, collapsed, onToggle, onClearPin, onEvidence }: {
  layer?: SovereignEyeLayer;
  pinnedFeature: MapFeature | null;
  collapsed: boolean;
  onToggle: () => void;
  onClearPin: () => void;
  onEvidence: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="flex min-h-14 items-center justify-between border border-line-200 bg-paper-0 xl:min-h-[620px] xl:flex-col xl:py-3" aria-label="Focused layer tray">
        <button type="button" className="btn-ghost h-10 w-10 border-0 p-0" onClick={onToggle} aria-label="Expand focused layer tray">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <div className="flex items-center gap-2 px-2 xl:flex-col" title={layer?.label ?? "Focused layer"}>
          <Crosshair size={16} className="text-ink-700" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-signal-positive" aria-label={layer?.status ?? "No status"} />
        </div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500 [writing-mode:vertical-rl] xl:block">Focus</span>
      </aside>
    );
  }

  return (
    <aside className="border border-line-200 bg-paper-0 p-5" aria-label="Focused layer tray">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Focused layer</p>
          {!pinnedFeature ? <h3 className="mt-2 font-serif text-2xl text-ink-950">{layer?.label ?? "No layer focused"}</h3> : null}
        </div>
        <button type="button" className="btn-ghost h-9 w-9 shrink-0 p-0" onClick={onToggle} aria-label="Collapse focused layer tray">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      {pinnedFeature ? (
        <div className="mt-3">
          <InterpretationPanel feature={pinnedFeature} pinned onClose={onClearPin} onEvidence={onEvidence} />
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{layer?.narrative ?? "Choose a visible layer in the controls."}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Display" value={layer?.visible ? "On" : "Off"} />
            <Stat label="Status" value={layer?.status ?? "—"} />
            <Stat label="Evidence" value={String(layer?.evidenceCount ?? 0)} />
            <Stat label="Last update" value={layer?.updatedAt ? new Date(layer.updatedAt).toLocaleDateString() : "—"} />
          </dl>
          <div className="mt-5 border-t border-line-200 pt-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Evidence access</p>
            <div className="mt-3 flex gap-4 text-xs text-ink-700">
              <span className="flex items-center gap-2"><span className="h-2 w-2 border border-ink-700 bg-paper-0" /> Public {layer?.visibility.public ?? 0}</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 bg-narrative-500" /> Private {layer?.visibility.private ?? 0}</span>
            </div>
          </div>
          <div className="mt-5 border-t border-line-200 pt-4 text-xs leading-relaxed text-ink-500">
            <p className="flex items-center gap-2 text-ink-700"><Radio size={13} /> Hover or focus to interpret</p>
            <p className="mt-2">Click or tap any mark or legend item to pin its meaning here.</p>
          </div>
        </>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border border-line-200 p-3"><dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{label}</dt><dd className="mt-1 capitalize text-ink-950" data-numeric>{value}</dd></div>;
}