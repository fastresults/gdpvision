// Chamber 07 · Field desk · the state of a wave, stated honestly.
//
// Derived from counts that are already on the board. A wave with nothing
// invited and nothing returned is not "in the field" — it has not started.

import { cn } from "@/lib/utils";

export type WavePhase = "not_started" | "reaching" | "arriving" | "target_met" | "closed";

const LABEL: Record<WavePhase, string> = {
  not_started: "Not started",
  reaching: "Invitations out",
  arriving: "Returns arriving",
  target_met: "Target met",
  closed: "Closed",
};

const SESSION_LABEL: Record<WavePhase, string> = {
  not_started: "Not started",
  reaching: "Rooms seated",
  arriving: "Sessions captured",
  target_met: "All captured",
  closed: "Closed",
};

/** Phase of a questionnaire wave, from what has actually happened. */
export function collectionPhase(args: {
  complete: boolean;
  opened: boolean;
  invited: number;
  returned: number;
  target: number;
}): WavePhase {
  if (args.complete) return "closed";
  if (args.target > 0 && args.returned >= args.target) return "target_met";
  if (args.returned > 0) return "arriving";
  if (args.invited > 0) return "reaching";
  return "not_started";
}

/** Phase of a sessions wave. */
export function sessionPhase(args: {
  complete: boolean;
  scheduled: number;
  captured: number;
  planned: number;
}): WavePhase {
  if (args.complete) return "closed";
  if (args.planned > 0 && args.captured >= args.planned) return "target_met";
  if (args.captured > 0) return "arriving";
  if (args.scheduled > 0) return "reaching";
  return "not_started";
}

export function StatusPill({
  phase,
  variant = "collection",
}: {
  phase: WavePhase;
  variant?: "collection" | "sessions";
}) {
  const done = phase === "closed" || phase === "target_met";
  const label = variant === "sessions" ? SESSION_LABEL[phase] : LABEL[phase];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]",
        done
          ? "border-ink-950 bg-ink-950 text-paper-0"
          : phase === "not_started"
            ? "border-line-200 bg-paper-50 text-ink-500"
            : "border-ink-300 bg-paper-0 text-ink-800",
      )}
    >
      {phase !== "not_started" && !done ? (
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-700" />
      ) : null}
      {label}
    </span>
  );
}
