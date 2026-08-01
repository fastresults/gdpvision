// @domain personas
// @tables programme_decks
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · The commencement deck viewer. Opens over the briefing, walks
// the client through the order of process, and exports three ways: present
// full-screen, print to PDF, or download an editable .pptx.

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Play, Printer, X } from "lucide-react";

import { PrintSurface, printSurface } from "@/components/print/PrintSurface";
import type { ProgrammeDeck } from "@/lib/personas/programme-deck.functions";

import { exportDeckToPptx } from "./deck-pptx";
import { ScaledSlide, SlideBody } from "./SlideCanvas";

/** Surface id — the deck prints one 16:9 page per slide, and nothing else. */
export const DECK_PRINT_SURFACE = "deck";

export function DeckModal({
  open,
  deck,
  onClose,
}: {
  open: boolean;
  deck: ProgrammeDeck | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const total = deck?.slides.length ?? 0;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, deck?.version]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (presenting) {
          setPresenting(false);
          if (document.fullscreenElement) void document.exitFullscreen();
        } else onClose();
      }
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, presenting, total, onClose]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (!open || !deck) return null;

  const slide = deck.slides[index];

  const present = () => {
    setPresenting(true);
    void document.documentElement.requestFullscreen?.().catch(() => setPresenting(true));
  };

  const printDeck = () => {
    printSurface(DECK_PRINT_SURFACE, {
      title: `${deck.programmeTitle} — Commencement deck`,
    });
  };

  const download = async () => {
    setDownloading(true);
    try {
      await exportDeckToPptx(deck);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Commencement deck"
        className={
          presenting
            ? "fixed inset-0 z-[60] bg-ink-950"
            : "fixed inset-0 z-[60] flex flex-col bg-ink-950/70 p-2 sm:p-5"
        }
      >
        {presenting ? (
          <div className="flex h-full w-full items-center justify-center bg-ink-950">
            <ScaledSlide slide={slide} index={index} total={total} className="h-full w-full" />
            <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <NavButton dark onClick={() => setIndex((i) => Math.max(i - 1, 0))} dir="prev" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0/60">
                {index + 1} / {total}
              </span>
              <NavButton
                dark
                onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
                dir="next"
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col border border-line-200 bg-paper-0 shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 px-5 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  Chamber 07 · Commencement deck · v{deck.version}
                </p>
                <p className="mt-0.5 font-serif text-lg text-ink-950">{deck.programmeTitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={present}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <Play size={14} />
                  Present
                </button>
                <button
                  type="button"
                  onClick={printDeck}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <Printer size={14} />
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => void download()}
                  disabled={downloading}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {downloading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  PowerPoint
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close the deck"
                  className="btn-ghost inline-flex h-8 w-8 items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* thumbnails */}
              <nav className="order-2 flex gap-2 overflow-x-auto border-t border-line-200 p-3 lg:order-1 lg:w-[190px] lg:flex-col lg:overflow-y-auto lg:border-r lg:border-t-0">
                {deck.slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`shrink-0 border text-left transition-colors ${
                      i === index ? "border-gold-500" : "border-line-200 hover:border-ink-300"
                    }`}
                    style={{ width: 160 }}
                    aria-current={i === index}
                  >
                    <ScaledSlide slide={s} index={i} total={total} className="h-[90px] w-full" />
                    <span className="block truncate px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                      {String(i + 1).padStart(2, "0")} · {s.heading}
                    </span>
                  </button>
                ))}
              </nav>

              {/* stage */}
              <div className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
                <ScaledSlide
                  slide={slide}
                  index={index}
                  total={total}
                  className="min-h-[280px] flex-1 bg-paper-100/40"
                />
                <div className="flex items-center justify-between gap-3 border-t border-line-200 px-4 py-2.5">
                  <NavButton onClick={() => setIndex((i) => Math.max(i - 1, 0))} dir="prev" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {slide.eyebrow} · {index + 1} / {total}
                  </p>
                  <NavButton
                    onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
                    dir="next"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* print surface — one 16:9 sheet per slide */}
      <PrintSurface
        id={DECK_PRINT_SURFACE}
        rootId="deck-print-root"
        pageCss={PAGE_CSS}
        rootProps={{ "aria-hidden": "true" }}
      >
        {/* style first: the last page box must stay the last child */}
        <style>{PRINT_CSS}</style>
        {deck.slides.map((s, i) => (
          <div className="deck-print-page" key={`p-${s.id}`}>
            <SlideBody slide={s} index={i} total={total} />
          </div>
        ))}
      </PrintSurface>
    </>
  );
}

function NavButton({
  onClick,
  dir,
  dark,
}: {
  onClick: () => void;
  dir: "prev" | "next";
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
      className={`inline-flex h-8 w-8 items-center justify-center border ${
        dark
          ? "border-paper-0/25 text-paper-0 hover:border-paper-0/60"
          : "border-line-200 text-ink-700 hover:border-ink-300"
      }`}
    >
      {dir === "prev" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
  );
}

/**
 * The sheet. Declared in inches, not pixels: browsers silently discard a
 * pixel `size` of this magnitude and fall back to portrait Letter, which is
 * what cropped the slides and forced the orientation control to Portrait.
 * 20in x 11.25in is exactly 1920 x 1080 CSS px at 96dpi, so a slide occupies
 * one sheet at its authored size with no scaling anywhere in the chain — the
 * pixels on screen, in Present mode and on paper are the same pixels. The
 * PDF page is 1440 x 810pt, a true 16:9 landscape sheet that any printer or
 * viewer fits to its own paper.
 */
const PAGE_CSS = `
@media print {
  @page { size: 20in 11.25in; margin: 0; }
}
`;

/**
 * One authored 1920x1080 slide per sheet. Deliberately no `transform: scale()`
 * and no `zoom`: Chromium fragments the document against the unscaled box, so
 * a scaled slide is clipped to the sheet height *before* the scale applies and
 * only the top two thirds of every slide reaches the PDF. Matching the sheet
 * to the slide avoids the paginator entirely.
 */
const PRINT_CSS = `
@media print {
  html, body { background: #ffffff !important; }
  #deck-print-root {
    position: absolute;
    left: 0;
    top: 0;
    width: 1920px;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #deck-print-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .deck-print-page {
    position: relative;
    width: 1920px;
    height: 1080px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
    page-break-after: always;
    break-after: page;
  }
  .deck-print-page:last-child { page-break-after: auto; break-after: auto; }
}
`;
