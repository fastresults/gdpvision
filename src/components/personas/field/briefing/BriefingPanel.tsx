// @domain personas
// @tables programme_briefings
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx
//
// Chamber 07 · The Commencement Briefing desk. The super admin assembles the
// full client-facing dossier once the brief, programme, participants and
// instruments are on file, reads it on screen, exports it as a PDF, and
// records that it went to the client.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleDashed,
  Download,
  FileText,
  Loader2,
  Presentation,
  Printer,
  RefreshCw,
  Send,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { markBriefingShared } from "@/lib/personas/commencement-briefing.functions";
import { printSurface } from "@/components/print/PrintSurface";
import { useDossierActions } from "@/hooks/useDossierActions";

import { DeckModal } from "../deck/DeckModal";
import { ExportBriefingDialog } from "./ExportBriefingDialog";
import { ShareLinkBar } from "./ShareLinkBar";
import {
  BRIEFING_PRINT_SURFACE,
  DEFAULT_BRIEFING_PRINT_CONFIG,
  PrintableBriefing,
  type BriefingPrintConfig,
} from "./PrintableBriefing";

function dateLabel(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BriefingPanel({
  projectId,
  intent = "briefing",
  inputsUpdatedAt = null,
}: {
  projectId: string;
  intent?: "briefing" | "deck";
  inputsUpdatedAt?: string | null;
}) {
  const qc = useQueryClient();
  const [exportOpen, setExportOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState<BriefingPrintConfig>(
    DEFAULT_BRIEFING_PRINT_CONFIG,
  );
  const [active, setActive] = useState<string | null>(null);

  const sharedFn = useServerFn(markBriefingShared);

  const dossier = useDossierActions(projectId, inputsUpdatedAt);
  const { error } = dossier;

  const share = useMutation({
    mutationFn: (briefingId: string) => sharedFn({ data: { briefingId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["commencement-briefing", projectId] }),
  });

  // ── presentation deck ────────────────────────────────────────────────────
  const [deckOpen, setDeckOpen] = useState(false);

  const record = dossier.briefing;
  const doc = record?.document ?? null;
  const preflightReady = doc?.preflight?.every((item) => item.ready) ?? false;
  const source = doc?.source ?? {
    sourceName: "Legacy briefing — rebuild required",
    preparedFor: "",
    preparedBy: "",
    committedText: "",
  };
  const preflight = doc?.preflight ?? [];

  // Opened straight from the "Presentation" action: jump to the composed deck
  // once, when one exists for this briefing version and it passed preflight.
  const jumped = useRef(false);
  useEffect(() => {
    if (intent !== "deck" || jumped.current) return;
    if (!doc || !preflightReady) return;
    if (dossier.deck?.deck.briefingVersion !== doc.version) return;
    jumped.current = true;
    setDeckOpen(true);
  }, [intent, doc, preflightReady, dossier.deck]);


  const runExport = (config: BriefingPrintConfig) => {
    setPrintConfig(config);
    setExportOpen(false);
    // printSurface names the one document that may own the sheet — the deck
    // may also be mounted, and must not print alongside the briefing.
    printSurface(BRIEFING_PRINT_SURFACE, {
      title: doc ? `${doc.programmeTitle} — Commencement Briefing` : undefined,
    });
  };

  return (
    <section className="space-y-6">
      <header className="border-b border-line-200 pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Chamber 07 · Client dossier
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">Commencement briefing</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-700">
          The complete, plain-language account of what is about to happen: the brief as we
          understood it, the programme and its dates, the target personas we will hear from and why
          they were chosen, every question that will be asked, how the fieldwork will be run, and
          how the evidence will be judged and filed. Assemble it, read it, then send it before the
          first participant is contacted.
        </p>
      </header>

      {error && (
        <p className="border border-signal-negative/40 bg-signal-negative/5 px-4 py-3 text-sm text-ink-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => dossier.assembleBriefing()}
          disabled={dossier.assembling}
          className="btn-primary inline-flex items-center gap-2"
        >
          {dossier.assembling ? (
            <Loader2 size={14} className="animate-spin" />
          ) : record ? (
            <RefreshCw size={14} />
          ) : (
            <FileText size={14} />
          )}
          {dossier.assembling
            ? "Assembling the dossier…"
            : record
              ? "Re-assemble from current state"
              : "Assemble the briefing"}
        </button>

        {doc && (
          <>
            <button
              type="button"
              onClick={() =>
                runExport({
                  ...printConfig,
                  preparedFor: source.preparedFor,
                  preparedBy: source.preparedBy,
                })
              }
              disabled={!preflightReady}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              disabled={!preflightReady}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Download size={14} />
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => {
                if (dossier.deck?.deck.briefingVersion === doc.version) setDeckOpen(true);
                else dossier.composeDeck({ onDone: () => setDeckOpen(true) });
              }}
              disabled={dossier.composing || !preflightReady}
              className="btn-accent inline-flex items-center gap-2"
            >
              {dossier.composing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Presentation size={14} />
              )}
              {dossier.composing
                ? "Composing the deck…"
                : dossier.deck
                  ? `Open presentation deck · v${dossier.deck.version}`
                  : "Prepare presentation deck"}
            </button>
            {dossier.deck && (
              <button
                type="button"
                onClick={() => dossier.composeDeck({ onDone: () => setDeckOpen(true) })}
                disabled={dossier.composing}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Re-compose deck
              </button>
            )}

            {record && record.status !== "shared" && (
              <button
                type="button"
                onClick={() => share.mutate(record.id)}
                disabled={share.isPending}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <Send size={14} />
                Mark as sent to client
              </button>
            )}
          </>
        )}

        {record && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            v{record.version} · assembled {dateLabel(record.assembled_at)}
            {record.shared_at ? ` · sent ${dateLabel(record.shared_at)}` : ""}
          </span>
        )}
      </div>

      {/* Whether what is on file still describes the programme as it stands. */}
      {(dossier.briefingStaleReason || dossier.deckStaleReason) && (
        <div className="border-l-2 border-gold-500 bg-paper-100/50 px-4 py-2 text-sm text-ink-800">
          {dossier.briefingStaleReason && <p>Dossier · {dossier.briefingStaleReason}</p>}
          {dossier.deckStaleReason && <p>Deck · {dossier.deckStaleReason}</p>}
        </div>
      )}

      {dossier.loading && <p className="text-sm text-ink-500">Reading the dossier…</p>}

      {!dossier.loading && !doc && (

        <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
          <p className="font-serif text-lg text-ink-950">No briefing assembled yet.</p>
          <p className="mt-1 max-w-xl text-sm text-ink-700">
            Assembling reads the committed brief, the approved programme, the recruited panels and
            the drafted instruments, and composes them into one client-ready document. Nothing is
            invented — re-assemble at any time to capture the current state.
          </p>
        </div>
      )}

      {doc && (
        <>
          <div className="border border-line-200 bg-paper-0 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Client-output provenance
                </p>
                <p className="mt-1 text-sm text-ink-800">
                  {source.sourceName} · Prepared for {source.preparedFor || "not found in source"}
                </p>
              </div>
              <span className={preflightReady ? "text-gold-500" : "text-signal-negative"}>
                {preflightReady ? "Ready to export" : "Export blocked"}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              {preflightReady
                ? `All ${preflight.length} sections trace to the client brief; no internal platform references found.`
                : "One or more sections carry internal platform references. Re-assemble before exporting."}
            </p>
            <div className="mt-3 grid gap-px bg-line-200 sm:grid-cols-2 lg:grid-cols-4">
              {preflight.map((item) => (
                <div key={item.sectionId} className="bg-paper-0 p-3 text-xs text-ink-700">
                  <p className="font-medium text-ink-950">{item.sectionId}</p>
                  <p>{item.source.replace(/_/g, " ")}</p>
                  {item.bannedTermCount === 0 ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-ink-500">
                      <Check size={12} className="text-gold-500" />
                      Clean — drawn from the governing brief
                    </p>
                  ) : (
                    <p className="mt-1 font-medium text-signal-negative">
                      {item.bannedTermCount} prohibited reference
                      {item.bannedTermCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {record && <ShareLinkBar briefingId={record.id} canPublish={preflightReady} />}

          {/* Readiness at issue */}
          <div className="grid gap-px border border-line-200 bg-line-200 sm:grid-cols-2 lg:grid-cols-3">
            {doc.readiness.map((r) => (
              <div key={r.label} className="bg-paper-0 p-4">
                <div className="flex items-center gap-2">
                  {r.ready ? (
                    <Check size={14} className="text-gold-500" />
                  ) : (
                    <CircleDashed size={14} className="text-ink-300" />
                  )}
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {r.label}
                  </p>
                </div>
                <p className="mt-1.5 text-sm text-ink-800">{r.detail}</p>
              </div>
            ))}
          </div>

          {/* Masthead figures */}
          <div className="grid grid-cols-2 gap-px border border-line-200 bg-line-200 sm:grid-cols-4">
            <Figure label="Phases" value={doc.metrics.phases} />
            <Figure label="Participants" value={doc.metrics.participants} />
            <Figure label="Questions" value={doc.metrics.questions} />
            <Figure label="Waves" value={doc.metrics.waves} />
          </div>

          {/* On-screen reader */}
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <nav className="lg:sticky lg:top-6 lg:self-start">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Contents
              </p>
              <ol className="mt-3 space-y-1">
                {doc.sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#cb-${s.id}`}
                      onClick={() => setActive(s.id)}
                      className={`flex gap-3 border-l-2 py-1.5 pl-3 text-sm transition-colors ${
                        active === s.id
                          ? "border-gold-500 text-ink-950"
                          : "border-line-200 text-ink-700 hover:border-ink-300 hover:text-ink-950"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-gold-500">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="space-y-10">
              {doc.sections.map((s, i) => (
                <article
                  key={s.id}
                  id={`cb-${s.id}`}
                  className="scroll-mt-24 border-t border-line-200 pt-5"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                    {s.eyebrow}
                  </p>
                  <h3 className="mt-1 flex items-baseline gap-3 font-serif text-xl text-ink-950">
                    <span className="font-mono text-xs text-gold-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.heading}
                  </h3>
                  {s.opener ? (
                    <BriefOpenerBlock opener={s.opener} variant="screen" />
                  ) : (
                    <div className="cb-screen-prose mt-4 max-w-none text-sm leading-relaxed text-ink-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body_md}</ReactMarkdown>
                    </div>
                  )}

                </article>
              ))}
            </div>
          </div>

          <style>{SCREEN_PROSE_CSS}</style>

          <ExportBriefingDialog
            open={exportOpen}
            projectId={projectId}
            sourcePreparedFor={source.preparedFor}
            sourcePreparedBy={source.preparedBy}
            onClose={() => setExportOpen(false)}
            onExport={runExport}
          />
          <PrintableBriefing briefing={doc} config={printConfig} />
          <DeckModal
            open={deckOpen}
            deck={dossier.deck?.deck ?? null}
            stale={dossier.deckStale}
            recomposing={dossier.composing}
            onRecompose={() => dossier.composeDeck()}
            onClose={() => setDeckOpen(false)}
          />
        </>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper-0 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums text-ink-950">{value}</p>
    </div>
  );
}

const SCREEN_PROSE_CSS = `
.cb-screen-prose h3 { font-size: 0.95rem; font-weight: 600; margin: 1.6rem 0 0.5rem; color: inherit; }
.cb-screen-prose p { margin: 0 0 0.75rem; }
.cb-screen-prose ul, .cb-screen-prose ol { margin: 0 0 0.9rem 1.1rem; list-style: disc; }
.cb-screen-prose ol { list-style: decimal; }
.cb-screen-prose li { margin: 0 0 0.3rem; }
.cb-screen-prose hr { margin: 1.5rem 0; border-top: 1px solid var(--color-line-200); }
.cb-screen-prose table { width: 100%; border-collapse: collapse; margin: 0 0 1rem; font-size: 0.8rem; display: block; overflow-x: auto; }
.cb-screen-prose th { text-align: left; font-family: ui-monospace, monospace; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; padding: 0.4rem 0.75rem 0.4rem 0; border-bottom: 1px solid currentColor; white-space: nowrap; }
.cb-screen-prose td { padding: 0.5rem 0.75rem 0.5rem 0; border-bottom: 1px solid var(--color-line-200); vertical-align: top; }
`;
