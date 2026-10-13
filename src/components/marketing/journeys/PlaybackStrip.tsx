import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PlaybackStripProps {
  playing: boolean;
  reduced: boolean;
  first: boolean;
  last: boolean;
  progress: string;
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
  onToggle: () => void;
}

/** One shared playback vocabulary for national routes and Chamber examples. */
export function PlaybackStrip(props: PlaybackStripProps) {
  const controls = [
    { label: "Previous step", Icon: ChevronLeft, action: props.onPrevious, disabled: props.first },
    {
      label: props.playing ? "Pause" : "Play",
      Icon: props.playing ? Pause : Play,
      action: props.onToggle,
      disabled: props.reduced,
    },
    { label: "Next step", Icon: ChevronRight, action: props.onNext, disabled: props.last },
    { label: "Replay example", Icon: RotateCcw, action: props.onReplay, disabled: false },
  ];
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1" aria-label="Example playback">
        {controls.map(({ label, Icon, action, disabled }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="btn-ghost h-9 w-9 shrink-0 p-0"
                aria-label={label}
                disabled={disabled}
                onClick={action}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
        <span className="ml-2 text-[12px] tabular-nums text-ink-500">{props.progress}</span>
      </div>
    </TooltipProvider>
  );
}
