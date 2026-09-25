// Renders one investor package. Pure: no data fetching, no auth. Used by the
// admin print view and the public share page.
//
// `content` is validated against the kind's schema; anything that does not
// parse renders a quiet notice rather than a broken page. Print rules use
// named pages, so a teaser (Letter portrait) and a deck (16:9 landscape) can
// share a document without fighting over @page.

import {
  parsePackageContent,
  type DataRoomContent,
  type DeckContent,
  type MemorandumContent,
  type TeaserContent,
} from "@/lib/investments/package-schema";

import { DataRoomLayout } from "./DataRoomLayout";
import { DeckLayout } from "./DeckLayout";
import { MemorandumLayout } from "./MemorandumLayout";
import { TeaserLayout } from "./TeaserLayout";

type Kind = "teaser" | "memorandum" | "data_room" | "deck";

/** Strip anything that could close the string or the style element. */
function cssString(s: string): string {
  return s.replace(/[\\"<>\n\r]/g, " ").slice(0, 120);
}

function printCss(runningHead: string): string {
  return `
@page pkg-letter { size: letter portrait; margin: 0.55in 0.65in; }
@page pkg-memo-cover { size: letter portrait; margin: 0.9in 0.85in; }
@page pkg-memo {
  size: letter portrait;
  margin: 0.9in 0.85in 0.8in;
  @top-left { content: "${cssString(runningHead)}"; font-family: "IBM Plex Mono", monospace; font-size: 7pt; letter-spacing: 0.14em; text-transform: uppercase; color: #48607f; }
  @bottom-right { content: counter(page); font-family: "IBM Plex Mono", monospace; font-size: 7.5pt; color: #48607f; }
}
@page pkg-deck { size: 13.333in 7.5in; margin: 0; }
@media print {
  .pkg-no-print { display: none !important; }
  .pkg-doc, .pkg-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pkg-doc .pkg-sheet { border: 0 !important; padding: 0 !important; margin: 0 !important; max-width: none !important; min-height: 0 !important; box-shadow: none !important; }
  .pkg-doc .pkg-teaser, .pkg-doc .pkg-dataroom { page: pkg-letter; }
  .pkg-doc .pkg-memo-cover { page: pkg-memo-cover; break-after: page; }
  .pkg-doc .pkg-memo-body { page: pkg-memo; }
  .pkg-doc .pkg-memo-section h2, .pkg-doc .pkg-dataroom-folder h2 { break-after: avoid; }
  .pkg-doc .pkg-memo-section { break-inside: auto; }
  .pkg-doc .pkg-memo-section p { orphans: 3; widows: 3; }
  .pkg-doc tr { break-inside: avoid; }
  .pkg-doc .pkg-slide { page: pkg-deck; break-before: page; break-inside: avoid; width: 13.333in !important; height: 7.5in !important; max-width: none !important; aspect-ratio: auto !important; border: 0 !important; margin: 0 !important; }
  .pkg-doc .pkg-slide:first-child { break-before: auto; }
}`;
}

function Fallback() {
  return (
    <div className="mx-auto max-w-[8.5in] border border-line-200 bg-paper-0 px-6 py-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
        Document unavailable
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-700">
        This document could not be displayed. It may have been saved in an earlier format. Generate
        a new version to view it.
      </p>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <aside
      className="pkg-no-print mx-auto mb-6 max-w-[8.5in] border border-signal-caution px-5 py-4 print:hidden"
      aria-label="Unverified numbers"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal-caution">
        {warnings.length} unverified {warnings.length === 1 ? "number" : "numbers"}
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-700">
        These figures were written by the model but do not match any fact the package was built
        from. They are marked “[unverified: …]” in the text. Regenerate, or correct the project
        record, before approving.
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] leading-snug text-ink-950">
        {warnings.slice(0, 20).map((w, i) => (
          <li key={i}>{w}</li>
        ))}
        {warnings.length > 20 ? (
          <li className="text-ink-500">and {warnings.length - 20} more.</li>
        ) : null}
      </ul>
    </aside>
  );
}

export function PackageDocument({
  kind,
  content,
  showWarnings = true,
}: {
  kind: Kind;
  content: unknown;
  /** Optional: hide the unverified-number note (for example on an investor-facing page). */
  showWarnings?: boolean;
}) {
  const parsed = parsePackageContent(kind, content);
  if (!parsed.ok || parsed.data.kind !== kind) return <Fallback />;
  const c = parsed.data;
  const runningHead = `${c.project_title} · Information memorandum`;

  return (
    <div className="pkg-doc" data-kind={kind}>
      <style>{printCss(runningHead)}</style>
      {showWarnings ? <Warnings warnings={c.warnings} /> : null}
      {c.kind === "teaser" ? <TeaserLayout c={c as TeaserContent} /> : null}
      {c.kind === "memorandum" ? <MemorandumLayout c={c as MemorandumContent} /> : null}
      {c.kind === "data_room" ? <DataRoomLayout c={c as DataRoomContent} /> : null}
      {c.kind === "deck" ? <DeckLayout c={c as DeckContent} /> : null}
    </div>
  );
}
