// Chamber 07 · One save affordance, worn identically by every field stage.
//
// Three states and no ambiguity: unsaved changes, saving, saved. If the stored
// copy moved underneath unsaved work, the user chooses which one survives.

import { AlertTriangle, Check, Loader2, Save } from "lucide-react";

export function SaveBar({
  what,
  dirty,
  saving,
  savedAt,
  error,
  conflict,
  onSave,
  onTakeServer,
  onKeepMine,
  disabled,
}: {
  /** What is being saved, lower case: "the instrument". */
  what: string;
  dirty: boolean;
  saving: boolean;
  savedAt?: string | null;
  error?: string | null;
  conflict?: boolean;
  onSave: () => void;
  onTakeServer?: () => void;
  onKeepMine?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          className={
            dirty
              ? "font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700"
              : "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500"
          }
        >
          {saving
            ? "Saving…"
            : dirty
              ? `Unsaved changes to ${what}`
              : savedAt
                ? `Saved · ${new Date(savedAt).toLocaleTimeString()}`
                : "No changes"}
        </span>
        <button
          type="button"
          className={dirty ? "btn-primary" : "btn-secondary"}
          disabled={saving || disabled || !dirty}
          onClick={onSave}
        >
          {saving ? (
            <Loader2 size={11} className="animate-spin" />
          ) : dirty ? (
            <Save size={12} />
          ) : (
            <Check size={12} />
          )}
          {dirty ? `Save ${what}` : "Saved"}
        </button>
      </div>

      {conflict ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border border-amber-500/40 bg-amber-500/5 p-2">
          <AlertTriangle size={12} className="text-amber-700" />
          <span className="text-[12px] text-ink-800">
            The stored version of {what} changed while you were editing.
          </span>
          <button type="button" className="btn-ghost" onClick={onKeepMine}>
            Keep mine
          </button>
          <button type="button" className="btn-ghost" onClick={onTakeServer}>
            Take theirs
          </button>
        </div>
      ) : null}

      {error ? <p className="text-right text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
