// @domain personas
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx
//
// Chamber 07 · A two-part control: the wide half opens what exists, the
// narrow half regenerates it. Used for the client dossier and its deck, where
// "open" and "rebuild from current state" are equally routine acts.

import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

export function SplitAction({
  label,
  icon,
  title,
  regenerateTitle,
  onOpen,
  onRegenerate,
  busy = false,
  disabled = false,
  stale = false,
}: {
  label: string;
  icon: ReactNode;
  title?: string;
  regenerateTitle: string;
  onOpen: () => void;
  onRegenerate: () => void;
  busy?: boolean;
  disabled?: boolean;
  stale?: boolean;
}) {
  return (
    <span className="inline-flex items-stretch">
      <button
        type="button"
        onClick={onOpen}
        title={title}
        disabled={disabled || busy}
        className="btn-secondary inline-flex items-center gap-2 rounded-none"
      >
        {icon}
        {label}
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        title={regenerateTitle}
        aria-label={regenerateTitle}
        disabled={disabled || busy}
        className={cn(
          "btn-secondary relative inline-flex items-center justify-center rounded-none border-l-0 px-2",
        )}
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RefreshCw size={13} className={stale ? "text-gold-500" : undefined} />
        )}
        {stale && !busy ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold-500"
          />
        ) : null}
      </button>
    </span>
  );
}
