// @domain personas
// @tables country_sources, country_source_documents, country_source_chunks

// Chamber 07 · Shared filing loop — intake material → second brain.
//
// Server-only helper behind `fileProgrammeMaterial` and the brief
// commit/amendment paths in project-brief.functions.ts. Single
// implementation of the dedup contract: sources dedupe on
// (country, url, visibility), documents on content_hash, and any copy of the
// same URL already filed for this project pins the visibility so re-filing
// never forks a duplicate under a second visibility.

import { upsertCountrySource } from "@/lib/corpus/writers.server";
import { chunkText, embedBatch } from "@/lib/country-onboarding/ingest.server";
import { contentHash } from "@/lib/country-onboarding/memory-dedup.server";
import type { supabaseAdmin } from "@/integrations/supabase/client.server";

export type IntakeItem = {
  role: "brief" | "context";
  name: string;
  path: string;
  mime: string;
  excerpt?: string;
};

export type FileIntakeResult = {
  filed: number;
  chunks: number;
  skipped: number;
  errors: string[];
};

/** A link intake stores its URL in `path`; a file intake stores a storage path. */
export function intakeSourceUrl(item: { path: string }): string {
  if (/^https?:\/\//i.test(item.path)) return item.path;
  return `study-artifacts://${item.path}`;
}

export async function fileIntakeItems(opts: {
  admin: typeof supabaseAdmin;
  countryCode: string;
  projectId: string;
  userId: string | null;
  defaultVisibility: "public" | "private";
  items: IntakeItem[];
}): Promise<FileIntakeResult> {
  const { admin, countryCode, projectId, userId } = opts;
  const usable = opts.items.filter((i) => (i.excerpt ?? "").trim().length >= 200);
  if (usable.length === 0) {
    return { filed: 0, chunks: 0, skipped: opts.items.length, errors: [] };
  }

  // Reuse the visibility of any copy of the same URL already filed for this
  // project, so amendments never fork a duplicate under a second visibility.
  const urls = [...new Set(usable.map(intakeSourceUrl))];
  const { data: existing } = await admin
    .from("country_sources")
    .select("url, visibility")
    .eq("country_code", countryCode)
    .in("url", urls)
    .contains("tags", [`project:${projectId}`]);
  const visibilityByUrl = new Map<string, "public" | "private">(
    (existing ?? []).map((r) => [
      (r as { url: string }).url,
      ((r as { visibility?: string }).visibility as "public" | "private") ?? opts.defaultVisibility,
    ]),
  );

  let filed = 0;
  let totalChunks = 0;
  const errors: string[] = [];

  for (const item of usable) {
    try {
      const text = (item.excerpt ?? "").trim();
      const url = intakeSourceUrl(item);
      const visibility = visibilityByUrl.get(url) ?? opts.defaultVisibility;
      const isPrivate = visibility === "private";
      const src = await upsertCountrySource(admin, {
        country_code: countryCode,
        url,
        title: item.name,
        org: item.role === "brief" ? "Programme brief" : "Programme context",
        kind: "document",
        connection_kind: /^https?:/i.test(url) ? "link" : "document",
        storage_path: /^https?:/i.test(url) ? null : item.path,
        quality_score: item.role === "brief" ? 5 : 4,
        tags: ["chamber-07", "research-programme", `role:${item.role}`, `project:${projectId}`],
        created_by: userId,
        visibility,
        owner_country_code: isPrivate ? countryCode : null,
        uploaded_by: isPrivate ? userId : null,
      });
      if (!src?.id) throw new Error("source upsert returned nothing");

      const hash = contentHash(text);
      const { data: existingDoc } = await admin
        .from("country_source_documents")
        .select("id")
        .eq("country_source_id", src.id)
        .eq("content_hash", hash)
        .maybeSingle();
      if (existingDoc) {
        filed++;
        continue;
      }

      const chunks = chunkText(text);
      if (chunks.length === 0) continue;

      const { data: docRow, error: dErr } = await admin
        .from("country_source_documents")
        .insert({
          country_source_id: src.id,
          raw_text: text,
          char_count: text.length,
          chunk_count: chunks.length,
          content_hash: hash,
          visibility,
          owner_country_code: isPrivate ? countryCode : null,
          uploaded_by: isPrivate ? userId : null,
        })
        .select("id")
        .single();
      if (dErr || !docRow) throw new Error(dErr?.message ?? "document insert failed");

      const vectors: number[][] = [];
      for (let i = 0; i < chunks.length; i += 64) {
        vectors.push(...(await embedBatch(chunks.slice(i, i + 64))));
      }
      const rows = chunks.map((c, idx) => ({
        document_id: docRow.id,
        country_code: countryCode,
        chunk_index: idx,
        content: c,
        embedding: vectors[idx] ? `[${vectors[idx].join(",")}]` : null,
        visibility,
        owner_country_code: isPrivate ? countryCode : null,
        uploaded_by: isPrivate ? userId : null,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error: cErr } = await admin
          .from("country_source_chunks")
          .insert(rows.slice(i, i + 100));
        if (cErr) throw new Error(cErr.message);
      }

      filed++;
      totalChunks += chunks.length;
    } catch (e) {
      errors.push(`${item.name}: ${(e as Error).message}`);
    }
  }

  return {
    filed,
    chunks: totalChunks,
    skipped: opts.items.length - usable.length,
    errors,
  };
}
