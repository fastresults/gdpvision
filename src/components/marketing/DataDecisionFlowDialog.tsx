import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DataDecisionFlow } from "./DataDecisionFlow";

export function DataDecisionFlowDialog() {
  return (
    <div className="group relative flex flex-col items-center">
      {/* Faint engraved sketch rings — hint at the living diagram behind the plate */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-7 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-25"
      >
        <svg
          viewBox="0 0 200 200"
          fill="none"
          className="h-full w-full animate-[spin_60s_linear_infinite] motion-reduce:animate-none"
        >
          <circle cx="100" cy="100" r="78" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" className="text-ink-950" />
          <circle cx="100" cy="100" r="94" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 8" className="text-ink-950" />
          <path
            d="M100 5v10M100 185v10M5 100h10M185 100h10"
            stroke="currentColor"
            strokeWidth="0.6"
            className="text-ink-950"
          />
        </svg>
      </div>
      <DialogPrimitive.Root>
        <DialogPrimitive.Trigger asChild>
          <button type="button" className="btn-flow-lens relative z-10 flex-col gap-2 px-10 py-5">
            {/* Internal gold frame of the etched plate */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 border border-gold-500/40" />
            {/* Corner etchings */}
            <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-2 w-2 border-l border-t border-gold-500/70" />
            <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 h-2 w-2 border-r border-t border-gold-500/70" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 left-2.5 h-2 w-2 border-b border-l border-gold-500/70" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 right-2.5 h-2 w-2 border-b border-r border-gold-500/70" />

            {/* The lens emblem */}
            <span className="relative flex h-9 w-9 items-center justify-center">
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

            <span className="block font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-ink-950">
              Data &amp; Decision Flow
            </span>
            <span className="block font-display text-[11px] italic text-ink-700">
              Engage the National Decision Engine
            </span>
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-paper-0" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-y-auto bg-paper-0 p-4 md:p-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">The National Decision Engine</div>
                <DialogPrimitive.Title className="mt-1 font-display text-2xl text-ink-950 md:text-3xl">
                  How evidence becomes better decisions — and more GDP
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 max-w-2xl text-[14px] text-ink-700">
                  Every part of the platform, and how it moves the economy forward.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="btn-ghost shrink-0" aria-label="Close">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="md:min-h-0 md:flex-1">
              <DataDecisionFlow />
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
