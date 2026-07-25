import { Sliders, GitCompare, Send, Megaphone } from "lucide-react";

export function ScenarioActionBar({
  onAdjust,
  onCompare,
  onSendCabinet,
  onSendNarrative,
}: {
  onAdjust: () => void;
  onCompare: () => void;
  onSendCabinet: () => void;
  onSendNarrative: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-30 mt-8 border-t border-line-200 bg-paper-0/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={onAdjust} className="btn-primary inline-flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5" /> Adjust
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onCompare} className="btn-ghost inline-flex items-center gap-2">
            <GitCompare className="h-3.5 w-3.5" /> Compare
          </button>
          <button
            type="button"
            onClick={onSendNarrative}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <Megaphone className="h-3.5 w-3.5" /> Send to Narrative
          </button>
          <button
            type="button"
            onClick={onSendCabinet}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Send className="h-3.5 w-3.5" /> Send to Cabinet
          </button>
        </div>
      </div>
    </div>
  );
}
