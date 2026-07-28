import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FileText } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ChamberSummary } from "@/lib/executive/types";
import { exactStamp, type ExecutiveDetail } from "@/lib/executive/detail";
import { sheetRoute, slugForIndex, type ExecutiveSurface } from "@/lib/executive/chambers";

import { TONE_TEXT, relTime, shortDate } from "./tone";
import { TempoSparkline } from "./TempoSparkline";

interface DetailCtx {
  open: (d: ExecutiveDetail) => void;
}

const Ctx = createContext<DetailCtx>({ open: () => {} });

/** Every clickable line on the brief and the room sheets opens through this. */
export function useExecutiveDetail(): DetailCtx {
  return useContext(Ctx);
}

export function ExecutiveDetailProvider({
  code,
  surface,
  chambers,
  children,
}: {
  code: string;
  surface: ExecutiveSurface;
  chambers: ChamberSummary[];
  children: ReactNode;
}) {
  const [detail, setDetail] = useState<ExecutiveDetail | null>(null);
  const open = useCallback((d: ExecutiveDetail) => setDetail(d), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DetailModal
        code={code}
        surface={surface}
        chambers={chambers}
        detail={detail}
        onClose={() => setDetail(null)}
      />
    </Ctx.Provider>
  );
}

function headline(d: ExecutiveDetail): string {
  switch (d.kind) {
    case "kpi":
      return d.value ?? "Not yet on record";
    case "alert":
      return d.text;
    case "activity":
      return d.text;
    case "due":
      return d.label;
    case "chamber":
      return d.chamber.title;
  }
}

function stampOf(d: ExecutiveDetail): string | null {
  switch (d.kind) {
    case "activity":
      return d.at;
    case "due":
      return d.at;
    case "chamber":
      return d.chamber.last_activity_at;
    default:
      return null;
  }
}

function DetailModal({
  code,
  surface,
  chambers,
  detail,
  onClose,
}: {
  code: string;
  surface: ExecutiveSurface;
  chambers: ChamberSummary[];
  detail: ExecutiveDetail | null;
  onClose: () => void;
}) {
  const index = detail ? (detail.kind === "chamber" ? detail.chamber.index : detail.index) : undefined;
  const chamber = chambers.find((c) => c.index === index) ?? null;

  const eyebrow = detail
    ? detail.kind === "chamber"
      ? `Chamber ${detail.chamber.index} · ${detail.chamber.owner}`
      : index
        ? `Chamber ${index}${detail.title ? ` · ${detail.title.replace(/^The\s+/, "")}` : ""}`
        : "Standing of the nation"
    : "";

  const stamp = detail ? stampOf(detail) : null;

  return (
    <Dialog open={detail !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px] border-line-200 bg-paper-0 p-0 print:hidden">
        {detail && (
          <div className="p-6">
            <DialogHeader className="space-y-0 text-left">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                <p className="truncate font-mono text-[9px] uppercase tracking-[0.28em] text-ink-500">
                  {eyebrow}
                </p>
                {stamp && (
                  <span
                    data-numeric
                    className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500"
                  >
                    {relTime(stamp)}
                  </span>
                )}
              </div>
              <DialogTitle
                className={`mt-3 font-serif text-[27px] leading-tight ${
                  detail.kind === "kpi" ? TONE_TEXT[detail.tone ?? "neutral"] : "text-ink-950"
                }`}
              >
                {headline(detail)}
              </DialogTitle>
              {detail.kind === "kpi" && (
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                  {detail.label}
                </p>
              )}
            </DialogHeader>

            <div className="mt-5 border-t border-line-200">
              {detail.kind === "kpi" && (
                <>
                  <Row label="Measure" value={detail.label} />
                  {detail.note && <Row label="Reads" value={detail.note} />}
                  <Row label="State" value={toneWord(detail.tone)} />
                </>
              )}

              {detail.kind === "alert" && (
                <>
                  <Row label="Why it ranked" value={detail.because.join(" · ") || "—"} />
                  <Row label="Severity" value={String(Math.round(detail.severity))} numeric />
                </>
              )}

              {detail.kind === "activity" && <Row label="On record" value={exactStamp(detail.at)} />}

              {detail.kind === "due" && (
                <>
                  <Row label="Due" value={detail.at ? exactStamp(detail.at) : "Nothing scheduled"} />
                  <Row label="State" value={detail.state} />
                </>
              )}

              {detail.kind === "chamber" && (
                <>
                  <div className="grid grid-cols-3 gap-4 border-b border-line-100 py-4">
                    {detail.chamber.kpis.slice(0, 3).map((k, i) => (
                      <div key={i} className="min-w-0">
                        <div
                          data-numeric
                          className={`truncate font-serif text-[24px] leading-none ${TONE_TEXT[k.tone ?? "neutral"]}`}
                        >
                          {k.value ?? "—"}
                        </div>
                        <div className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                          {k.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-b border-line-100 py-4 text-ink-950">
                    <TempoSparkline data={detail.chamber.tempo} />
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                      Tempo · 30 days
                    </p>
                  </div>
                  <Row
                    label="Awaiting you"
                    value={
                      detail.chamber.alerts.length
                        ? `${detail.chamber.alerts.length} item${detail.chamber.alerts.length === 1 ? "" : "s"}`
                        : "Nothing outstanding"
                    }
                  />
                  <Row
                    label="Next due"
                    value={
                      detail.chamber.next_due
                        ? `${shortDate(detail.chamber.next_due.at)} · ${detail.chamber.next_due.label}`
                        : "Nothing scheduled"
                    }
                  />
                </>
              )}

              {index && (
                <Row label="Owning office" value={chamber?.owner ?? detail.kind !== "chamber" ? (detail.kind !== "chamber" ? (detail.owner ?? chamber?.owner ?? "—") : "—") : "—"} />
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {chamber && (
                <Link
                  to={sheetRoute(surface)}
                  params={{ code, chamber: slugForIndex(chamber.index) }}
                  onClick={onClose}
                  className="btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em]"
                >
                  <FileText size={12} strokeWidth={1.5} /> Room sheet
                </Link>
              )}
              {chamber && (
                <Link
                  to={chamber.to}
                  params={{ code }}
                  onClick={onClose}
                  className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em]"
                >
                  Enter the chamber <ArrowUpRight size={13} strokeWidth={1.75} />
                </Link>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function toneWord(t?: string): string {
  switch (t) {
    case "positive":
      return "Inside tolerance";
    case "caution":
      return "Watch";
    case "negative":
      return "Out of tolerance";
    case "quiet":
      return "Not yet on record";
    default:
      return "On record";
  }
}

function Row({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-4 border-b border-line-100 py-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</span>
      <span {...(numeric ? { "data-numeric": true } : {})} className="min-w-0 text-[14.5px] leading-snug text-ink-950">
        {value}
      </span>
    </div>
  );
}
