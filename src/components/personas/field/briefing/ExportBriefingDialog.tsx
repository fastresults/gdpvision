// @domain personas
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Configure the cover of the Commencement Briefing, then hand off to the
// browser's print-to-PDF. Mirrors the Chamber 08 export dialog so both
// client-facing documents behave identically.

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { DEFAULT_BRIEFING_PRINT_CONFIG, type BriefingPrintConfig } from "./PrintableBriefing";

const STORAGE_KEY = "chamber07:briefing-print-config";

export function ExportBriefingDialog({
  open,
  projectId,
  sourcePreparedFor,
  sourcePreparedBy,
  onClose,
  onExport,
}: {
  open: boolean;
  projectId: string;
  sourcePreparedFor: string;
  sourcePreparedBy: string;
  onClose: () => void;
  onExport: (config: BriefingPrintConfig) => void;
}) {
  const [config, setConfig] = useState<BriefingPrintConfig>(DEFAULT_BRIEFING_PRINT_CONFIG);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BriefingPrintConfig>;
        setConfig({
          ...DEFAULT_BRIEFING_PRINT_CONFIG,
          ...parsed,
          preparedFor: sourcePreparedFor,
          preparedBy: sourcePreparedBy,
        });
        return;
      }
    } catch {
      /* ignore */
    }
    setConfig({
      ...DEFAULT_BRIEFING_PRINT_CONFIG,
      preparedFor: sourcePreparedFor,
      preparedBy: sourcePreparedBy,
    });
  }, [open, projectId, sourcePreparedBy, sourcePreparedFor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = <K extends keyof BriefingPrintConfig>(k: K, v: BriefingPrintConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const submit = () => {
    try {
      const { preparedFor: _preparedFor, preparedBy: _preparedBy, ...display } = config;
      localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(display));
    } catch {
      /* ignore */
    }
    onExport(config);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-line-200 bg-paper-0 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line-200 px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              Export · Client briefing
            </p>
            <h3 id="briefing-export-title" className="mt-1 font-serif text-xl text-ink-950">
              Configure the dossier
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-ghost -mr-2 -mt-1 inline-flex h-8 w-8 items-center justify-center"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <Field
            label="Classification"
            hint="Shown as the top-left eyebrow on the cover page."
            value={config.classification}
            onChange={(v) => update("classification", v)}
          />
          <Field
            label="Prepared for"
            hint="Read from the committed governing brief."
            value={config.preparedFor}
            readOnly
          />
          <Field
            label="Prepared by"
            hint="Read from the committed governing brief."
            value={config.preparedBy}
            readOnly
          />
          <Field label="Date" value={config.dateLabel} onChange={(v) => update("dateLabel", v)} />

          <div className="space-y-2 border-t border-line-200 pt-4">
            <Toggle
              label="Cover page"
              checked={config.showCoverPage}
              onChange={(v) => update("showCoverPage", v)}
            />
            {/* Contents page is always issued: a client dossier without a
                table of contents is not shippable. */}

            <Toggle
              label="Page numbers"
              checked={config.showPageNumbers}
              onChange={(v) => update("showPageNumbers", v)}
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-line-200 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download size={14} />
            Print / Save as PDF
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className="mt-1.5 w-full border border-line-200 bg-paper-0 px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-500"
      />
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-ink-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-ink-950"
      />
      {label}
    </label>
  );
}
