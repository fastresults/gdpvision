// In-page viewer for one investor package version. Opened from the Investor
// materials panel ("Open"), driven by the `view` search param so Back closes
// it and a refresh reopens it. Print prints only the document.

import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getPackage, type PackageSummary } from "@/lib/investments/packages.functions";
import { PACKAGE_KIND_LABEL } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import { PackageDocument } from "./PackageDocument";

const STATUS_CLASS = {
  draft: "text-draft-state",
  approved: "text-signal-positive",
  superseded: "text-ink-400",
} as const;

const tool = "px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]";

export function PackageViewerDialog({
  code,
  projectId,
  packageId,
  versions,
  onSelect,
  onClose,
  canApprove,
  approving,
  onApprove,
}: {
  code: string;
  projectId: string;
  packageId: string | null;
  /** All versions of the same kind, newest first. */
  versions: PackageSummary[];
  onSelect: (id: string) => void;
  onClose: () => void;
  canApprove: (p: PackageSummary) => boolean;
  approving: boolean;
  onApprove: (p: PackageSummary) => void;
}) {
  const fetchPackage = useServerFn(getPackage);
  const q = useQuery({
    queryKey: ["investment-package", code, packageId],
    queryFn: () => fetchPackage({ data: { code, packageId: packageId! } }),
    enabled: !!packageId,
  });
  const pkg = q.data;
  const summary = versions.find((v) => v.id === packageId) ?? null;
  const idx = versions.findIndex((v) => v.id === packageId);
  const newer = idx > 0 ? versions[idx - 1] : null;
  const older = idx >= 0 && idx < versions.length - 1 ? versions[idx + 1] : null;

  useEffect(() => {
    const done = () => document.body.classList.remove("print-viewer");
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  function print() {
    document.body.classList.add("print-viewer");
    const prev = document.title;
    if (pkg) document.title = `${pkg.project_title} — ${PACKAGE_KIND_LABEL[pkg.kind]} v${pkg.version}`;
    window.print();
    document.title = prev;
  }

  return (
    <Dialog open={!!packageId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pkg-viewer-dialog flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none border-line-200 bg-paper-0 p-0 sm:h-[92vh] sm:w-[95vw] sm:max-w-[95vw] [&>button:last-child]:print:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-200 px-4 py-2.5 pr-12 print:hidden">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-[13px]">
            <DialogTitle className="truncate text-[14px] font-normal text-ink-950">
              {pkg ? PACKAGE_KIND_LABEL[pkg.kind] : "Investor package"}
            </DialogTitle>
            <DialogDescription asChild>
              <span className="text-ink-500">
                {pkg ? `v${pkg.version} · from project v${pkg.project_version}` : "Loading…"}
              </span>
            </DialogDescription>
            {pkg ? (
              <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", STATUS_CLASS[pkg.status])}>
                {pkg.status}
              </span>
            ) : null}
            {summary && summary.kind !== "data_room" && summary.warnings > 0 ? (
              <span className="text-signal-caution">{summary.warnings} unverified</span>
            ) : null}
            {pkg?.stale ? (
              <span className="text-signal-caution">
                <Explain id="packages.stale">out of date</Explain>
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {versions.length > 1 ? (
              <div className="flex items-center gap-1">
                <button type="button" className={cn("btn-ghost", tool)} disabled={!older} onClick={() => older && onSelect(older.id)} aria-label="Older version">
                  ←
                </button>
                <select
                  className="border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[11px] text-ink-950"
                  value={packageId ?? ""}
                  onChange={(e) => onSelect(e.target.value)}
                  aria-label="Version"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} · {v.status}
                    </option>
                  ))}
                </select>
                <button type="button" className={cn("btn-ghost", tool)} disabled={!newer} onClick={() => newer && onSelect(newer.id)} aria-label="Newer version">
                  →
                </button>
              </div>
            ) : null}
            {summary && summary.status === "draft" ? (
              <button
                type="button"
                className={cn("btn-secondary", tool)}
                disabled={!canApprove(summary) || approving}
                onClick={() => onApprove(summary)}
              >
                {approving ? "Approving…" : `Approve v${summary.version}`}
              </button>
            ) : null}
            {packageId ? (
              <Link
                to="/admin/countries/$code/investments/$id/package/$packageId"
                params={{ code, id: projectId, packageId }}
                className={cn("btn-ghost", tool)}
              >
                Open full page
              </Link>
            ) : null}
            <button type="button" className={cn("btn-primary", tool)} onClick={print} disabled={!pkg}>
              Print / Save PDF
            </button>
          </div>
        </div>
        <div className="pkg-viewer-body min-h-0 flex-1 overflow-auto bg-paper-50 px-3 py-6 sm:px-8 print:bg-paper-0 print:p-0">
          {q.isLoading ? <p className="mx-auto max-w-[8.5in] text-[13px] text-ink-500">Loading…</p> : null}
          {q.error ? (
            <p role="alert" className="mx-auto max-w-[8.5in] text-[13px] text-signal-negative">
              {(q.error as Error).message}
            </p>
          ) : null}
          {pkg ? <PackageDocument kind={pkg.kind} content={pkg.content} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
