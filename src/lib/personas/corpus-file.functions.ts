// @domain personas
// @tables country_sources, country_source_documents, country_source_chunks
// @ui src/components/personas/ProgrammeSetup.tsx; src/components/personas/StudyWizard/ProgramBriefIntake.tsx

// Chamber 07 · File Stage 00 intake material into the second brain.
//
// Every item a principal gives the chamber — the single governing Source Brief
// and any number of Supporting Context items — is registered as a country
// source, stored as a document, chunked and embedded. Roles are carried on the
// source tags (`role:brief` / `role:context`) so downstream retrieval can weigh
// the brief above its context. Idempotent: dedupe is (country, url, visibility)
// on the source and content_hash on the document, so re-filing writes nothing.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  role: z.enum(["brief", "context"]),
  name: z.string().min(1).max(300),
  path: z.string().max(600),
  mime: z.string().max(200),
  excerpt: z.string().max(200_000).optional(),
});

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  projectId: z.string().uuid(),
  visibility: z.enum(["public", "private"]).default("public"),
  items: z.array(ItemSchema).max(25),
});

/** A link intake stores its URL in `path`; a file intake stores a storage path. */
function sourceUrlFor(item: z.infer<typeof ItemSchema>): string {
  if (/^https?:\/\//i.test(item.path)) return item.path;
  return `study-artifacts://${item.path}`;
}

export const fileProgrammeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorise against the country before touching the admin client.
    const { data: allowed, error: accErr } = await supabase.rpc("has_country_access", {
      _user_id: userId,
      _country_code: data.countryCode,
    });
    if (accErr) throw new Error(accErr.message);
    if (!allowed) throw new Error("No access to this country's corpus.");

    const usable = data.items.filter((i) => (i.excerpt ?? "").trim().length >= 200);
    if (usable.length === 0) return { filed: 0, chunks: 0, skipped: data.items.length };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertCountrySource } = await import("@/lib/corpus/writers.server");
    const { chunkText, embedBatch } = await import("@/lib/country-onboarding/ingest.server");
    const { contentHash } = await import("@/lib/country-onboarding/memory-dedup.server");

    let filed = 0;
    let totalChunks = 0;
    const errors: string[] = [];

    for (const item of usable) {
      try {
        const text = (item.excerpt ?? "").trim();
        const url = sourceUrlFor(item);
        const src = await upsertCountrySource(supabaseAdmin, {
          country_code: data.countryCode,
          url,
          title: item.name,
          org: item.role === "brief" ? "Programme brief" : "Programme context",
          kind: "document",
          connection_kind: /^https?:/i.test(url) ? "link" : "document",
          storage_path: /^https?:/i.test(url) ? null : item.path,
          quality_score: item.role === "brief" ? 5 : 4,
          tags: ["chamber-07", "research-programme", `role:${item.role}`, `project:${data.projectId}`],
          created_by: userId,
          visibility: data.visibility,
          owner_country_code: data.visibility === "private" ? data.countryCode : null,
          uploaded_by: data.visibility === "private" ? userId : null,
        });
        if (!src?.id) throw new Error("source upsert returned nothing");

        const hash = contentHash(text);
        const { data: existingDoc } = await supabaseAdmin
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

        const { data: docRow, error: dErr } = await supabaseAdmin
          .from("country_source_documents")
          .insert({
            country_source_id: src.id,
            raw_text: text,
            char_count: text.length,
            chunk_count: chunks.length,
            content_hash: hash,
            visibility: data.visibility,
            owner_country_code: data.visibility === "private" ? data.countryCode : null,
            uploaded_by: data.visibility === "private" ? userId : null,
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
          country_code: data.countryCode,
          chunk_index: idx,
          content: c,
          embedding: vectors[idx] ? `[${vectors[idx].join(",")}]` : null,
          visibility: data.visibility,
          owner_country_code: data.visibility === "private" ? data.countryCode : null,
          uploaded_by: data.visibility === "private" ? userId : null,
        }));
        for (let i = 0; i < rows.length; i += 100) {
          const { error: cErr } = await supabaseAdmin
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
      skipped: data.items.length - usable.length,
      ...(errors.length ? { errors } : {}),
    };
  });
