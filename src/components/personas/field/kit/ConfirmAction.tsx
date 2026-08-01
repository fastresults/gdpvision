// Chamber 07 · Field desk · a decision that cannot be taken blind.
//
// Closing a wave ends the collection of evidence. It gets a sentence stating
// exactly what will be true afterwards, and a second press.

import { useState } from "react";

import { cn } from "@/lib/utils";

export function ConfirmAction({
  label,
  confirmLabel = "Yes, close it",
  consequence,
  disabled,
  busy,
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel?: string;
  /** Plain statement of what will be true after this fires. */
  consequence: string;
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        className={cn("btn-ghost", className)}
        disabled={disabled || busy}
        onClick={() => setArmed(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="animate-in fade-in-0 zoom-in-95 w-full border border-ink-950 bg-paper-50 p-3 duration-150">
      <p className="text-[13px] leading-relaxed text-ink-900">{consequence}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {busy ? "Closing…" : confirmLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setArmed(false)}>
          Keep it open
        </button>
      </div>
    </div>
  );
}
