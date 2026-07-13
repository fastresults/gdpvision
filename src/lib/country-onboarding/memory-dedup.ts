// Shared helpers for enforcing the "no duplicate corpus data" rule
// on memory_objects. See mem://features/second-brain-no-duplicates.

import { createHash } from "crypto";

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

/** sha256 hex of a scraped document body; used to dedupe
 *  country_source_documents on (country_source_id, content_hash). */
export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
