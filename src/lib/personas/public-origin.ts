// Chamber 07 · Where a participant link actually lives.
//
// A participant must never be asked to sign in. Links issued from the
// workspace preview host (id-preview--….lovableproject.com) are gated by the
// editor's own login, so the address baked into an invitation can never be
// taken from whatever browser the admin happened to be using. Everything that
// hands a link to a member of the public resolves it through here.

/** The canonical public front door for participant-facing pages. */
export const DEFAULT_PUBLIC_ORIGIN = "https://gdpvision.com";

const GATED_HOST = /(^|\.)lovableproject\.com$|^id-preview--|(^|\.)lovable\.dev$/i;

/** True when the address would put a participant in front of a login screen. */
export function isGatedOrigin(candidate: string | null | undefined): boolean {
  if (!candidate) return true;
  try {
    const url = new URL(candidate);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false;
    return GATED_HOST.test(url.hostname) || url.hostname.startsWith("id-preview--");
  } catch {
    return true;
  }
}

/** Normalise to a bare `scheme://host` with no trailing slash. */
function normalise(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Pick the first address a participant can actually open.
 * Candidates are tried in order; gated hosts are discarded.
 */
export function resolvePublicOrigin(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const clean = normalise(candidate.trim());
    if (!clean) continue;
    if (isGatedOrigin(clean)) continue;
    return clean;
  }
  return DEFAULT_PUBLIC_ORIGIN;
}

/** Server-side resolution: configured public site first, then the caller's hint. */
export function serverPublicOrigin(hint?: string | null): string {
  return resolvePublicOrigin(process.env["PUBLIC_SITE_URL"], hint, DEFAULT_PUBLIC_ORIGIN);
}

/** Browser-side resolution: never the preview host. */
export function browserPublicOrigin(): string {
  const configured =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.["VITE_PUBLIC_SITE_URL"] as string | undefined)
      : undefined;
  const here = typeof window === "undefined" ? null : window.location.origin;
  return resolvePublicOrigin(configured, here, DEFAULT_PUBLIC_ORIGIN);
}

/** The one place a participant link is spelled. */
export function participantLink(origin: string, token: string, optOut = false): string {
  return `${origin}/f/${token}${optOut ? "?opt_out=1" : ""}`;
}

/** The one place a public client dossier link is spelled. */
export function dossierLink(origin: string, token: string): string {
  return `${resolvePublicOrigin(origin, DEFAULT_PUBLIC_ORIGIN)}/d/${encodeURIComponent(token)}`;
}

/** The one place a public client presentation link is spelled. */
export function deckLink(origin: string, token: string): string {
  return `${resolvePublicOrigin(origin, DEFAULT_PUBLIC_ORIGIN)}/p/${encodeURIComponent(token)}`;
}
