// @domain personas
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx
//
// Chamber 07 · The commencement briefing read inside a modal, so the principal
// never loses their place in the field rail. Print and export live in the panel.

import { useEffect } from "react";
import { X } from "lucide-react";

import { BriefingPanel } from "./BriefingPanel";

export function BriefingModal({
  open,
  projectId,
  onClose,
}: {
  open: boolean;
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
      aria-label="Commencement briefing"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-5xl flex-col border border-line-200 bg-paper-0 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line-200 px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Chamber 07 · Client dossier
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the briefing"
            className="btn-ghost inline-flex h-8 w-8 items-center justify-center"
          >
            <X size={14} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5">
          <BriefingPanel projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
