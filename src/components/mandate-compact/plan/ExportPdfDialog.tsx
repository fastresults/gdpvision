// @domain mandate-compact
// @ui src/components/mandate-compact/plan/PlanPanel.tsx
//
// One-click "Export PDF" flow. Opens a small dialog to configure the cover
// page (classification, prepared-for/-by, date), page numbers, and TOC —
// then swaps document.title and calls window.print(). The browser's native
// print-to-PDF renders <PrintablePlan/> via the print-only stylesheet.

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import type { TransformationalPlan } from "@/lib/mandate-compact/transformational-plan.functions";
import {
  DEFAULT_PRINT_CONFIG,
  type PrintConfig,
} from "@/components/mandate-compact/plan/PrintablePlan";

const STORAGE_KEY = "mandate-compact:print-config";

export function ExportPdfDialog({
  plan,
  open,
  onClose,
  onExport,
}: {
  plan: TransformationalPlan;
  open: boolean;
  onClose: () => void;
  onExport: (config: PrintConfig) => void;
}) {
  const [config, setConfig] = useState<PrintConfig>(DEFAULT_PRINT_CONFIG);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PrintConfig>;
        setConfig({ ...DEFAULT_PRINT_CONFIG, ...parsed });
        return;
      }
    } catch {
      /* ignore */
    }
    setConfig(DEFAULT_PRINT_CONFIG);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = <K extends keyof PrintConfig>(k: K, v: PrintConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const submit = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* ignore */
    }
    onExport(config);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-export-title"
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
              Export · Cabinet Report
            </p>
            <h3 id="pdf-export-title" className="mt-1 font-serif text-xl text-ink-950">
              Configure PDF
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
            value={config.preparedFor}
            onChange={(v) => update("preparedFor", v)}
          />
          <Field
            label="Prepared by"
            value={config.preparedBy}
            onChange={(v) => update("preparedBy", v)}
          />
          <Field
            label="Date"
            value={config.dateLabel}
            onChange={(v) => update("dateLabel", v)}
          />

          <div className="space-y-3 border-t border-line-200 pt-4">
            <Toggle
              label="Cover page"
              hint="Editorial title page with the classification block and mandate metrics."
              checked={config.showCoverPage}
              onChange={(v) => update("showCoverPage", v)}
            />
            <Toggle
              label="Table of contents"
              checked={config.showToc}
              onChange={(v) => update("showToc", v)}
            />
            <Toggle
              label="Page numbers"
              hint="Rendered in the bottom-right of every non-cover page."
              checked={config.showPageNumbers}
              onChange={(v) => update("showPageNumbers", v)}
            />
          </div>

          <p className="border-t border-line-200 pt-4 text-[11px] leading-relaxed text-ink-500">
            The browser print dialog opens next — choose{" "}
            <span className="font-medium text-ink-950">"Save as PDF"</span> as
            the destination. Suggested filename:{" "}
            <span className="font-mono text-[10px] text-ink-700">
              {suggestFilename(plan)}
            </span>
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line-200 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={submit} className="btn-primary inline-flex items-center gap-2">
            <Download size={14} /> Export PDF
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
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full border border-line-200 bg-paper-0 px-3 py-2 text-sm text-ink-950 focus:border-ink-950 focus:outline-none"
      />
      {hint && (
        <span className="mt-1 block text-[11px] leading-snug text-ink-500">
          {hint}
        </span>
      )}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-ink-950"
      />
      <span>
        <span className="block text-sm text-ink-950">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export function suggestFilename(plan: TransformationalPlan): string {
  const slug = (plan.title ?? "transformational-plan")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return `${plan.country_code}-${slug}-v${plan.version}.pdf`;
}

/**
 * Trigger the browser print flow. Swaps document.title so the browser
 * suggests a sensible filename in the "Save as PDF" dialog, then restores it.
 */
export function triggerPdfPrint(filename: string) {
  const original = document.title;
  document.title = filename.replace(/\.pdf$/i, "");
  // Give React a tick to flush any final state changes to the DOM.
  window.setTimeout(() => {
    window.print();
    // Restore title after the print dialog closes (best-effort — some
    // browsers block until after; the afterprint event is the reliable hook).
    const restore = () => {
      document.title = original;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    // Safety net in case afterprint never fires (rare).
    window.setTimeout(() => {
      if (document.title !== original) document.title = original;
    }, 30_000);
  }, 50);
}
