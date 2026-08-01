// @domain personas
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx
//
// Chamber 07 · The internal tracker in a modal, so the operator never leaves
// the field rail to see who owns what.

import { useEffect } from "react";
import { X } from "lucide-react";

import { TrackerBoard } from "./TrackerBoard";

export function TrackerModal({
  open,
  code,
  projectId,
  onClose,
}: {
  open: boolean;
  code: string;
  projectId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project tracker"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-5xl flex-col border border-line-200 bg-paper-0 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line-200 px-5 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              Internal · not client-facing
            </p>
            <p className="font-serif text-lg text-ink-950">Project tracker</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost px-2">
            <X size={16} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <TrackerBoard code={code} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
