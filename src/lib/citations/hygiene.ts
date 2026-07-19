export type CitableCitation = {
  n?: number;
  url?: string | null;
  title?: string | null;
  label?: string | null;
  org?: string | null;
  kind?: string | null;
  ref?: string | null;
  excerpt?: string | null;
  quote?: string | null;
  domain?: string | null;
  published_at?: string | null;
  [key: string]: unknown;
};

const CITATION_RE = /\[([\d\s,]+)\](?:\[([\d\s,]+)\])*/g;

export function isValidCitationUrl(value?: string | null): value is string {
  if (!value || typeof value !== "string") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function hostFromUrl(value?: string | null): string | null {
  if (!isValidCitationUrl(value)) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function hasCitableUrl(citation?: CitableCitation | null): citation is CitableCitation & { url: string } {
  return !!citation && isValidCitationUrl(citation.url);
}

export function normalizeCitableCitations(input?: Array<CitableCitation | string | number> | null): CitableCitation[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((citation, index) => {
    if (typeof citation === "string") {
      return isValidCitationUrl(citation) ? [{ n: index + 1, url: citation }] : [];
    }
    if (typeof citation === "number") return [];
    return hasCitableUrl(citation) ? [{ ...citation, url: citation.url.trim() }] : [];
  });
}

export function citationForNumber<T extends CitableCitation>(citations: T[], n: number): T | undefined {
  const direct = citations.find((citation) => citation?.n === n);
  if (direct) return hasCitableUrl(direct) ? direct : undefined;

  const fallback = citations[n - 1];
  if (fallback && fallback.n === undefined && hasCitableUrl(fallback)) return fallback;
  return undefined;
}

export function hasAnyCitableCitation(citations: unknown): boolean {
  return Array.isArray(citations) && citations.some((citation) => hasCitableUrl(citation as CitableCitation));
}

export function extractCitationNumbers(text?: string | null): number[] {
  if (!text) return [];
  const seen = new Set<number>();
  for (const match of text.matchAll(/\[([\d\s,]+)\]/g)) {
    for (const raw of match[1].split(",")) {
      const n = Number(raw.trim());
      if (Number.isFinite(n) && n > 0) seen.add(n);
    }
  }
  return [...seen];
}

export function validCitationsForRefs<T extends CitableCitation>(citations: T[], refs: unknown): T[] {
  const wanted = Array.isArray(refs)
    ? refs.map((ref) => Number(ref)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const wantedSet = new Set(wanted);
  const valid = citations.filter(hasCitableUrl);
  return wantedSet.size ? valid.filter((citation) => citation.n !== undefined && wantedSet.has(citation.n)) : valid;
}

export function sanitizeCitationMarkersInText<T extends CitableCitation>(text: string, citations: T[]): string {
  const valid = citations.filter(hasCitableUrl);
  if (!text) return "";

  return text
    .replace(CITATION_RE, (chunk) => {
      const refs: number[] = [];
      for (const group of String(chunk).matchAll(/\[([\d\s,]+)\]/g)) {
        for (const raw of group[1].split(",")) {
          const n = Number(raw.trim());
          if (Number.isFinite(n) && n > 0 && citationForNumber(valid, n) && !refs.includes(n)) refs.push(n);
        }
      }
      return refs.length ? `[${refs.join(", ")}]` : "";
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function sanitizeJsonCitationMarkers<T extends CitableCitation>(value: unknown, citations: T[]): unknown {
  if (typeof value === "string") return sanitizeCitationMarkersInText(value, citations);
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonCitationMarkers(item, citations));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeJsonCitationMarkers(item, citations)]),
    );
  }
  return value;
}

export function refsFromTextAndModel(text: string | null | undefined, modelRefs: unknown): number[] {
  const refs = new Set(extractCitationNumbers(text));
  if (Array.isArray(modelRefs)) {
    for (const ref of modelRefs) {
      const n = Number(ref);
      if (Number.isFinite(n) && n > 0) refs.add(n);
    }
  }
  return [...refs];
}