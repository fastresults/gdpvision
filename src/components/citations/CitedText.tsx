import { Fragment, type ReactNode } from "react";

import { CitationSup, type CitationRef } from "./CitationSup";
import { citationForNumber, normalizeCitableCitations, sanitizeCitationMarkersInText } from "@/lib/citations/hygiene";

// Matches [5], [5][7], [5,7,10] (with optional whitespace).
const CITATION_RE = /\[([\d\s,]+)\](?:\[([\d\s,]+)\])*/g;
const URL_RE = /(https?:\/\/[^\s)]+)/g;

export type CitationInput = Array<CitationRef | string | number>;

function normalizeCitations(input?: CitationInput | null): CitationRef[] {
  return normalizeCitableCitations(input) as CitationRef[];
}

function citationFor(citations: CitationRef[], n: number): CitationRef | undefined {
  return citationForNumber(citations, n) as CitationRef | undefined;
}

function renderTextWithLinks(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let idx = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      <a
        key={`${keyBase}-u${idx++}`}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-950 underline decoration-line-200 underline-offset-2 hover:decoration-ink-950"
      >
        {m[0]}
      </a>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Renders a plain string, converting [N] / [N][M] / [N,M] into
 * hoverable superscript citation chips backed by `citations`.
 */
export function CitedText({
  text,
  citations,
  className,
}: {
  text: string;
  citations?: CitationInput | null;
  className?: string;
}) {
  const cites = normalizeCitations(citations);
  const sanitizedText = sanitizeCitationMarkersInText(text, cites);
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  // Reset lastIndex explicitly since we use the /g flag.
  const re = new RegExp(CITATION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(sanitizedText)) !== null) {
    const start = m.index;
    if (start > cursor) {
      out.push(
        <Fragment key={`t-${key++}`}>
          {renderTextWithLinks(sanitizedText.slice(cursor, start), `t${key}`)}
        </Fragment>,
      );
    }
    // The whole match may include several consecutive [N] groups.
    const chunk = m[0];
    const numbers: number[] = [];
    for (const grp of chunk.matchAll(/\[([\d\s,]+)\]/g)) {
      for (const raw of grp[1].split(",")) {
        const n = Number(raw.trim());
        if (Number.isFinite(n) && n > 0) numbers.push(n);
      }
    }
    for (const n of numbers) {
      out.push(<CitationSup key={`c-${key++}`} n={n} citation={citationFor(cites, n)} />);
    }
    cursor = start + chunk.length;
  }
  if (cursor < sanitizedText.length) {
    out.push(
      <Fragment key={`t-${key++}`}>
        {renderTextWithLinks(sanitizedText.slice(cursor), `tf${key}`)}
      </Fragment>,
    );
  }

  return <span className={className}>{out}</span>;
}
