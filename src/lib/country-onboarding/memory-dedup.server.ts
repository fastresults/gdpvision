// Server-only helpers for corpus dedup. Kept out of `memory-dedup.ts` so
// the client bundle never tries to resolve `node:crypto`.
import { createHash } from "crypto";

/** sha256 hex of a scraped document body; used to dedupe
 *  country_source_documents on (country_source_id, content_hash). */
export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
