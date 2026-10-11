import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ChamberDecisionJourneys } from "./ChamberDecisionJourneys";
import { DataDecisionFlow } from "./DataDecisionFlow";

type FlowMode = "national" | "chamber";

/**
 * Engraved instrument plate that opens the decision presentation.
 * Two variants share one plate contract (`btn-flow-lens`): the lens emblem for
 * the national map, the ten-cell grid for the Chamber journeys.
 */
function FlowLensPlate({
  mode,
  headline,
  caption,
  emblem,
  onPick,
  ...rest
}: {
  mode: FlowMode;
  headline: string;
  caption: string;
  emblem: "lens" | "grid";
  onPick: () => void;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(event) => {
        onPick();
        rest.onClick?.(event);
      }}
      data-mode={mode}
      className="btn-flow-lens relative z-10 w-full flex-row items-center gap-3 px-4 py-4 text-left sm:px-5"
    >
      {/* Internal gold frame of the etched plate */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5 border border-gold-500/40"
      />
      {/* Corner etchings */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-2.5 h-2 w-2 border-l border-t border-gold-500/70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-2.5 h-2 w-2 border-r border-t border-gold-500/70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2.5 left-2.5 h-2 w-2 border-b border-l border-gold-500/70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2.5 right-2.5 h-2 w-2 border-b border-r border-gold-500/70"
      />

      {emblem === "lens" ? (
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-gold-500 animate-pulse motion-reduce:animate-none"
          />
          <span
            aria-hidden="true"
            className="absolute inset-1 rounded-full border border-dashed border-ink-950/50 animate-[spin_14s_linear_infinite] motion-reduce:animate-none"
          />
          <svg viewBox="0 0 24 24" className="relative h-4 w-4 fill-gold-500" aria-hidden="true">
            <path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z" />
          </svg>
        </span>
      ) : (
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-gold-500/70"
          />
          <svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((col) =>
              [0, 1].map((row) => (
                <rect
                  key={`${col}-${row}`}
                  x={0.9 + col * 4.5}
                  y={7.2 + row * 4.5}
                  width={3.4}
                  height={3.4}
                  className={
                    col === 2 && row === 0
                      ? "fill-gold-500 animate-pulse motion-reduce:animate-none"
                      : "fill-ink-950"
                  }
                />
              )),
            )}
          </svg>
        </span>
      )}

      <span className="min-w-0">
        <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-950">
          {headline}
        </span>
        <span className="mt-1 block font-display text-[10px] italic leading-snug text-ink-700">
          {caption}
        </span>
      </span>
    </button>
  );
}

export function DataDecisionFlowDialog() {
  const [mode, setMode] = useState<FlowMode>("national");
  return (
    <div className="group relative flex w-full flex-col items-center">
      {/* Faint engraved sketch rings — hint at the living diagram behind the plates */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-25"
      >
        <svg
          viewBox="0 0 200 200"
          fill="none"
          className="h-full w-full animate-[spin_60s_linear_infinite] motion-reduce:animate-none"
        >
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 4"
            className="text-ink-950"
          />
          <circle
            cx="100"
            cy="100"
            r="94"
            stroke="currentColor"
            strokeWidth="0.3"
            strokeDasharray="1 8"
            className="text-ink-950"
          />
          <path
            d="M100 5v10M100 185v10M5 100h10M185 100h10"
            stroke="currentColor"
            strokeWidth="0.6"
            className="text-ink-950"
          />
        </svg>
      </div>
      <DialogPrimitive.Root>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <DialogPrimitive.Trigger asChild>
            <FlowLensPlate
              mode="national"
              emblem="lens"
              headline="Data & Decision Flow"
              caption="Engage the National Decision Engine"
              onPick={() => setMode("national")}
            />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Trigger asChild>
            <FlowLensPlate
              mode="chamber"
              emblem="grid"
              headline="By Chamber"
              caption="Follow one decision through its Chamber"
              onPick={() => setMode("chamber")}
            />
          </DialogPrimitive.Trigger>
        </div>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-paper-0" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-y-auto bg-paper-0 p-4 md:p-8">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                  GDPVision Decision Engine
                </div>
                <DialogPrimitive.Title className="mt-1 font-display text-2xl text-ink-950 md:text-3xl">
                  {mode === "national"
                    ? "How a nation decides faster — and why that raises GDP"
                    : "Follow one decision through the Chamber built to handle it"}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 max-w-2xl text-[14px] text-ink-700">
                  {mode === "national"
                    ? "One flow, five steps: evidence in, protected, worked, decided, GDP up."
                    : "Choose a real scenario, watch GDPVision select the Chamber, then open its method and executive value."}
                </DialogPrimitive.Description>
              </div>
              <div
                className="order-3 flex w-full justify-center gap-1 border-y border-line-200 py-2 md:order-none md:w-auto md:border-y-0 md:py-0"
                role="tablist"
                aria-label="Decision flow view"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "national"}
                  onClick={() => setMode("national")}
                  className={cn("btn-ghost", mode === "national" && "btn-filter-active")}
                >
                  National system
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "chamber"}
                  onClick={() => setMode("chamber")}
                  className={cn("btn-ghost", mode === "chamber" && "btn-filter-active")}
                >
                  By Chamber
                </button>
              </div>
              <DialogPrimitive.Close className="btn-ghost shrink-0" aria-label="Close">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex min-w-0 md:min-h-0 md:flex-1">
              {mode === "national" ? <DataDecisionFlow /> : <ChamberDecisionJourneys />}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <p className="relative z-10 mt-3 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
        Twenty scenarios — two for every Chamber
      </p>
    </div>
  );
}
