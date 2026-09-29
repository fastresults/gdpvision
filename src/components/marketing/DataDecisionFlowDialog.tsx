import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DataDecisionFlow } from "./DataDecisionFlow";

export function DataDecisionFlowDialog() {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className="btn-secondary">Data &amp; Decision Flow</button>
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
  );
}
