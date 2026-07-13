// Client-safe helpers for enforcing the "no duplicate corpus data" rule
// on memory_objects. See mem://features/second-brain-no-duplicates.
//
// NOTE: Node-only helpers (e.g. sha256 via node:crypto) live in
// `memory-dedup.server.ts` so this file stays browser-safe and can be
// imported from any `.functions.ts` module without breaking the client
// bundle.

/** Normalize a memory title the same way the DB unique index does:
 *  trim, collapse internal whitespace to a single space, lowercase.
 *  Keep in sync with `memory_objects_dedup_idx`. */
export function normalizeMemoryTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Postgres unique_violation error code. */
export const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as any).code === UNIQUE_VIOLATION);
}
