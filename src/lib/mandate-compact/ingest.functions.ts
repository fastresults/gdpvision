// @domain mandate-compact
// @tables mandate_compacts,country_manifestos,country_sources,country_source_documents,country_source_chunks,memory_objects,country_parties
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Mandate Compact — ingest.
// Turns a manifesto (URL + text, or raw pasted text) into a Compact draft while
// mirroring the artefact into the country's second brain (country_sources,
// chunk-level embeddings, memory_objects). Idempotent per
// (country_code, election_cycle).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IngestInput = z.object({
  countryCode: z.string().min(2).max(3),
  electionCycle: z.string().min(2).max(64),
  title: z.string().max(300).optional(),
  pmName: z.string().max(200).optional(),
  termStart: z.string().datetime().optional(),
  termEnd: z.string().datetime().optional(),
  governingPartyId: z.string().uuid().optional(),
  sourceUrl: z.string().url().optional(),
  sourceText: z.string().max(500_000).optional(),
  summary: z.string().max(2_000).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
});

export type IngestManifestoInput = z.infer<typeof IngestInput>;

export type IngestManifestoResult = {
  compact_id: string;
  manifesto_id: string | null;
  source_id: string | null;
  document_id: string | null;
  chunks_indexed: number;
  existed: boolean;
};

export const ingestManifesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IngestInput.parse(input))
  .handler(async ({ data, context }): Promise<IngestManifestoResult> => {
    // Authorize: caller must be super-admin OR have country access.
    const { supabase, userId } = context;
    const { data: allowed, error: aErr } = await supabase.rpc("has_country_access", {
      _user_id: userId,
      _country_code: data.countryCode,
    });
    if (aErr) throw new Error(`authorization check failed: ${aErr.message}`);
    if (!allowed) throw new Error("Forbidden: no access to this country");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ownerFields = data.visibility === "private"
      ? { visibility: "private" as const, owner_country_code: data.countryCode, uploaded_by: userId }
      : { visibility: "public" as const, owner_country_code: null, uploaded_by: userId };

    // 1) Resolve governing party (fallback: lookup the country's is_ruling row).
    let partyId = data.governingPartyId ?? null;
    let partyName: string | null = null;
    if (!partyId) {
      const { data: ruling } = await supabaseAdmin
        .from("country_parties")
        .select("id, name")
        .eq("country_code", data.countryCode)
        .eq("is_ruling", true)
        .maybeSingle();
      partyId = ruling?.id ?? null;
      partyName = ruling?.name ?? null;
    } else {
      const { data: p } = await supabaseAdmin
        .from("country_parties")
        .select("name")
        .eq("id", partyId)
        .maybeSingle();
      partyName = p?.name ?? null;
    }

    // 2) Upsert country_source (kind=manifesto) — deduped by URL when provided.
    let sourceId: string | null = null;
    if (data.sourceUrl) {
      const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
      const src = await upsertCountrySource(supabaseAdmin, {
        country_code: data.countryCode,
        url: data.sourceUrl,
        title: data.title ?? `${partyName ?? "Governing party"} manifesto — ${data.electionCycle}`,
        org: partyName ?? "Government",
        kind: "manifesto",
        tags: ["mandate-compact", "manifesto", data.electionCycle],
        quality_score: 3,
        active: true,
        visibility: data.visibility,
      });
      sourceId = src?.id ?? null;
    }

    // 3) Chunk + embed into corpus (only when we have text).
    let documentId: string | null = null;
    let chunksIndexed = 0;
    if (sourceId && data.sourceText && data.sourceText.trim().length > 200) {
      try {
        const [{ contentHash }, { chunkText, embedBatch }] = await Promise.all([
          import("@/lib/country-onboarding/memory-dedup.server"),
          import("@/lib/country-onboarding/ingest.server"),
        ]);
        const hash = contentHash(data.sourceText);
        const { data: existingDoc } = await supabaseAdmin
          .from("country_source_documents")
          .select("id, chunk_count")
          .eq("country_source_id", sourceId)
          .eq("content_hash", hash)
          .maybeSingle();
        if (existingDoc?.id) {
          documentId = existingDoc.id as string;
          chunksIndexed = (existingDoc.chunk_count as number) ?? 0;
        } else {
          const chunks = chunkText(data.sourceText);
          if (chunks.length) {
            const { data: docRow, error: dErr } = await supabaseAdmin
              .from("country_source_documents")
              .insert({
                country_source_id: sourceId,
                raw_text: data.sourceText,
                char_count: data.sourceText.length,
                chunk_count: chunks.length,
                content_hash: hash,
                visibility: data.visibility,
                owner_country_code: ownerFields.owner_country_code,
                uploaded_by: userId,
              })
              .select("id")
              .single();
            if (dErr || !docRow) throw new Error(dErr?.message ?? "manifesto document insert failed");
            documentId = docRow.id as string;

            const vectors: number[][] = [];
            for (let i = 0; i < chunks.length; i += 64) {
              const embs = await embedBatch(chunks.slice(i, i + 64));
              vectors.push(...embs);
            }
            const rows = chunks.map((c, idx) => ({
              document_id: documentId!,
              country_code: data.countryCode,
              chunk_index: idx,
              content: c,
              embedding: `[${vectors[idx].join(",")}]`,
              visibility: data.visibility,
              owner_country_code: ownerFields.owner_country_code,
            }));
            for (let i = 0; i < rows.length; i += 100) {
              const { error: chunkErr } = await supabaseAdmin
                .from("country_source_chunks")
                .insert(rows.slice(i, i + 100));
              if (chunkErr) throw new Error(chunkErr.message);
            }
            chunksIndexed = rows.length;
          }
        }
      } catch (err) {
        // Corpus ingest is best-effort; the compact draft is still created.
        console.warn("[mandate-compact/ingest] corpus write failed:", (err as Error).message);
      }
    }

    // 4) Upsert country_manifestos row (needs a party_id — that column is NOT NULL).
    let manifestoId: string | null = null;
    if (partyId) {
      const { data: existingMani } = await supabaseAdmin
        .from("country_manifestos")
        .select("id")
        .eq("country_code", data.countryCode)
        .eq("party_id", partyId)
        .eq("election_cycle", data.electionCycle)
        .maybeSingle();
      if (existingMani?.id) {
        manifestoId = existingMani.id as string;
        await supabaseAdmin
          .from("country_manifestos")
          .update({
            title: data.title ?? undefined,
            summary: data.summary ?? undefined,
            source_url: data.sourceUrl ?? undefined,
            source_document_id: documentId ?? undefined,
            ...ownerFields,
          })
          .eq("id", manifestoId);
      } else {
        const { data: created, error: mErr } = await supabaseAdmin
          .from("country_manifestos")
          .insert({
            country_code: data.countryCode,
            party_id: partyId,
            election_cycle: data.electionCycle,
            title: data.title ?? null,
            summary: data.summary ?? null,
            source_url: data.sourceUrl ?? null,
            source_document_id: documentId,
            ...ownerFields,
          })
          .select("id")
          .single();
        if (mErr) throw new Error(`manifesto insert failed: ${mErr.message}`);
        manifestoId = created.id as string;
      }
    }

    // 5) Upsert the mandate_compacts draft (deduped on country + cycle).
    const { data: existingCompact } = await supabaseAdmin
      .from("mandate_compacts")
      .select("id, status")
      .eq("country_code", data.countryCode)
      .eq("election_cycle", data.electionCycle)
      .maybeSingle();

    let compactId: string;
    let existed = false;
    if (existingCompact?.id) {
      compactId = existingCompact.id as string;
      existed = true;
      await supabaseAdmin
        .from("mandate_compacts")
        .update({
          manifesto_id: manifestoId ?? undefined,
          governing_party_id: partyId ?? undefined,
          pm_name: data.pmName ?? undefined,
          title: data.title ?? undefined,
          summary: data.summary ?? undefined,
          term_start: data.termStart ?? undefined,
          term_end: data.termEnd ?? undefined,
          ...ownerFields,
        })
        .eq("id", compactId);
    } else {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("mandate_compacts")
        .insert({
          country_code: data.countryCode,
          manifesto_id: manifestoId,
          governing_party_id: partyId,
          election_cycle: data.electionCycle,
          pm_name: data.pmName ?? null,
          title: data.title ?? `${data.electionCycle} Mandate Compact`,
          summary: data.summary ?? null,
          term_start: data.termStart ?? null,
          term_end: data.termEnd ?? null,
          status: "draft",
          ...ownerFields,
        })
        .select("id")
        .single();
      if (cErr) throw new Error(`compact insert failed: ${cErr.message}`);
      compactId = created.id as string;
    }

    // 6) Mirror as a memory_object so Ask-the-Ledger and other chambers can cite it.
    try {
      const { upsertMemoryObject } = await import("@/lib/corpus/writers.server");
      await upsertMemoryObject({
        scope_key: data.countryCode,
        kind: "mandate_compact",
        title: `Mandate Compact — ${data.electionCycle}`,
        payload: {
          compact_id: compactId,
          manifesto_id: manifestoId,
          election_cycle: data.electionCycle,
          pm_name: data.pmName,
          governing_party_id: partyId,
          governing_party_name: partyName,
          source_url: data.sourceUrl,
          summary: data.summary,
        },
        weight: 4,
        sector_code: "cross",
        source_id: sourceId,
      });
    } catch (memErr) {
      console.warn("[mandate-compact/ingest] memory_object write failed:", (memErr as Error).message);
    }

    return {
      compact_id: compactId,
      manifesto_id: manifestoId,
      source_id: sourceId,
      document_id: documentId,
      chunks_indexed: chunksIndexed,
      existed,
    };
  });
