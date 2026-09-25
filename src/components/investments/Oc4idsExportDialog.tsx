// Builds the OC4IDS package on the server, shows the validation findings, and
// only then offers the download.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportInvestmentsOc4ids } from "@/lib/investments/pipeline.functions";
import type { Oc4idsPackage, Oc4idsWarning } from "@/lib/investments/oc4ids";
import { cn } from "@/lib/utils";

import { Dot, ErrorText, errMessage, MicroLabel } from "./ui";

export function Oc4idsExportButton({ code }: { code: string }) {
  const exporter = useServerFn(exportInvestmentsOc4ids);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    package: Oc4idsPackage;
    warnings: Oc4idsWarning[];
  } | null>(null);

  async function prepare() {
    setOpen(true);
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await exporter({ data: { code } });
      setResult({ package: r.package as Oc4idsPackage, warnings: r.warnings });
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.package, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${code.toLowerCase()}-oc4ids-${result.package.publishedDate.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const errors = result?.warnings.filter((w) => w.level === "error") ?? [];
  const warnings = result?.warnings.filter((w) => w.level === "warning") ?? [];
  const grouped = new Map<string, Oc4idsWarning[]>();
  for (const w of result?.warnings ?? []) {
    const k = w.where === "package" ? "The package" : (w.title ?? w.where);
    grouped.set(k, [...(grouped.get(k) ?? []), w]);
  }

  return (
    <>
      <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={prepare}>
        Export OC4IDS
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-none border-line-200 bg-paper-0 sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal text-ink-950">
              Export to OC4IDS
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-600">
              <Explain id="investments.oc4ids">Approved projects only</Explain>, as an Open
              Contracting for Infrastructure Data Standard 0.9 project package. The sponsor and all
              compliance data are left out.
            </DialogDescription>
          </DialogHeader>
          {busy && <p className="text-sm text-ink-500">Building and checking the package…</p>}
          <ErrorText>{err}</ErrorText>
          {result && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <MicroLabel>Projects</MicroLabel>
                  <div className="tabular-nums text-ink-950">{result.package.projects.length}</div>
                </div>
                <div>
                  <MicroLabel>Would not validate</MicroLabel>
                  <div
                    className={cn(
                      "tabular-nums",
                      errors.length ? "text-signal-negative" : "text-signal-positive",
                    )}
                  >
                    {errors.length}
                  </div>
                </div>
                <div>
                  <MicroLabel>Worth fixing</MicroLabel>
                  <div
                    className={cn(
                      "tabular-nums",
                      warnings.length ? "text-signal-caution" : "text-ink-950",
                    )}
                  >
                    {warnings.length}
                  </div>
                </div>
              </div>
              {result.warnings.length === 0 ? (
                <p className="border-l-2 border-l-signal-positive pl-2 text-sm text-signal-positive">
                  No problems found.
                </p>
              ) : (
                <div className="space-y-3">
                  {Array.from(grouped.entries()).map(([where, list]) => (
                    <div key={where}>
                      <div className="text-sm text-ink-950">{where}</div>
                      <ul className="mt-1 space-y-1">
                        {list.map((w, i) => (
                          <li
                            key={i}
                            className={cn(
                              "flex items-start gap-2 text-xs",
                              w.level === "error" ? "text-signal-negative" : "text-signal-caution",
                            )}
                          >
                            <Dot
                              tone={w.level === "error" ? "negative" : "caution"}
                              className="mt-1.5"
                            />
                            {w.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-200 pt-3">
                {errors.length > 0 && (
                  <span className="mr-auto text-xs text-signal-negative">
                    The file will not pass schema validation as it stands.
                  </span>
                )}
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={!result.package.projects.length}
                  onClick={download}
                >
                  {errors.length || warnings.length ? "Download anyway" : "Download"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
