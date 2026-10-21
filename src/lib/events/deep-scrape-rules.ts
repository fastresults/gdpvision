// Pure helpers for the summit deep scrape: natural keys and "blank, never guess" merging.

export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const speakerKey = (name: string, org?: string | null) => `${norm(name)}|${norm(org)}`;
export const sessionKey = (day: string | null | undefined, time: string | null | undefined, title: string) =>
  `${norm(day)}|${norm(time)}|${norm(title)}`;
export const partnerKey = (name: string) => norm(name);

/** Keep the current value unless it is empty; never replace with an empty found value. */
export function fillBlank<T extends string | null | undefined>(current: T, found: string | null | undefined): string | null {
  const c = (current ?? "").trim();
  const f = (found ?? "").trim();
  if (c) return c;
  return f || null;
}

/** De-duplicate a list by a key function, keeping the first, richest-looking entry. */
export function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const it of items) {
    const k = key(it);
    if (!k || k === "|" || k === "||") continue;
    if (!seen.has(k)) seen.set(k, it);
  }
  return [...seen.values()];
}

const SKIP = /\/(auth|login|sign-?in|privacy|terms|accessibility|cookies?)(\/|$)/i;
/** Same-host pages worth reading, homepage first. */
export function pickPages(home: string, links: string[], max = 16): string[] {
  let host = "";
  try { host = new URL(home).host; } catch { return [home]; }
  const out = new Set<string>([home.replace(/\/+$/, "")]);
  for (const l of links) {
    try {
      const u = new URL(l);
      if (u.host !== host || SKIP.test(u.pathname)) continue;
      u.hash = ""; u.search = "";
      out.add(u.toString().replace(/\/+$/, ""));
    } catch { /* skip */ }
    if (out.size >= max) break;
  }
  return [...out];
}
