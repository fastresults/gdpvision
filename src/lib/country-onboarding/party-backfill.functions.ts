// Admin-only backfill: for every existing country, deep-research the active
// political parties, flag the ruling party (or coalition lead), and — for
// that ruling lead — ingest the manifesto / programme of government into
// the country's Second Brain corpus.
//
// Persistent job rows in `party_backfill_runs` + `party_backfill_country_runs`
// let the admin UI poll for progress and survive tab closes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  country_code: z.string().optional(),
  country_codes: z.array(z.string()).optional(),
  force: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

// ---------------------------------------------------------------------------
// Public server functions
// ---------------------------------------------------------------------------

export const startPartyBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Sweep stale "running" runs (heartbeat >10 min old).
    await supabaseAdmin
      .from("party_backfill_runs")
      .update({
        status: "failed",
        error: "stalled",
        finished_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .lt("heartbeat_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    let countryQuery = supabaseAdmin.from("countries").select("code, name");
    const codes =
      (data.country_codes && data.country_codes.length ? data.country_codes : null) ??
      (data.country_code ? [data.country_code] : null);
    if (codes) countryQuery = countryQuery.in("code", codes);
    const { data: countries, error: cErr } = await countryQuery;
    if (cErr) throw new Error(`countries load failed: ${cErr.message}`);
    const targets = (countries ?? []) as Array<{ code: string; name: string }>;
    if (targets.length === 0) throw new Error("No target countries.");

    const { data: run, error: runErr } = await supabaseAdmin
      .from("party_backfill_runs")
      .insert({
        status: "queued",
        requested_by: context.userId,
        params: {
          country_codes: targets.map((c) => c.code),
          force: data.force,
          dry_run: data.dry_run,
        },
        totals: {
          attempted: 0,
          parties_upserted: 0,
          ruling_flagged: 0,
          manifesto_ingested: 0,
          failed: 0,
        },
        heartbeat_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr) throw new Error(`run insert failed: ${runErr.message}`);

    const countryRows = targets.map((c) => ({
      run_id: run.id,
      country_code: c.code,
      status: "queued",
    }));
    const { error: cRunErr } = await supabaseAdmin
      .from("party_backfill_country_runs")
      .insert(countryRows);
    if (cRunErr) throw new Error(`country runs insert failed: ${cRunErr.message}`);

    void processRun(run.id).catch(async (err) => {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      await admin
        .from("party_backfill_runs")
        .update({
          status: "failed",
          error: (err as Error).message.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    });

    return { run_id: run.id as string };
  });

export const getPartyBackfillRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run, error: rErr } = await supabaseAdmin
      .from("party_backfill_runs")
      .select("*")
      .eq("id", data.run_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!run) throw new Error("Run not found");
    const { data: countries, error: cErr } = await supabaseAdmin
      .from("party_backfill_country_runs")
      .select("*")
      .eq("run_id", data.run_id)
      .order("country_code");
    if (cErr) throw new Error(cErr.message);
    return { run, countries: countries ?? [] };
  });

export const listPartyBackfillRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).optional().default(10) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: runs, error } = await supabaseAdmin
      .from("party_backfill_runs")
      .select("id, status, params, totals, error, started_at, finished_at, heartbeat_at, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return runs ?? [];
  });

export const cancelPartyBackfillRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("party_backfill_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.run_id)
      .in("status", ["queued", "running"]);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Background processor
// ---------------------------------------------------------------------------

async function processRun(runId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildCountryContext } = await import("./country-context.server");
  const {
    partiesPass,
    rulingPass,
    manifestoPass,
    partyNameMatches,
  } = await import("./party-research.server");
  const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
  const { upsertMemoryObject } = await import("@/lib/corpus/writers.server");
  const { chunkText, embedBatch } = await import("./ingest.server");
  const { contentHash } = await import("./memory-dedup.server");

  const { data: run } = await supabaseAdmin
    .from("party_backfill_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (!run) return;

  const params = (run.params ?? {}) as {
    country_codes?: string[];
    force?: boolean;
    dry_run?: boolean;
  };
  const codes = params.country_codes ?? [];
  const dryRun = !!params.dry_run;
  const force = !!params.force;

  await supabaseAdmin
    .from("party_backfill_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", runId);

  const { data: countryRows } = await supabaseAdmin
    .from("countries")
    .select("code, name")
    .in("code", codes);
  const nameByCode = new Map<string, string>();
  for (const c of (countryRows ?? []) as Array<{ code: string; name: string }>) {
    nameByCode.set(c.code, c.name);
  }

  const totals = {
    attempted: 0,
    parties_upserted: 0,
    ruling_flagged: 0,
    manifesto_ingested: 0,
    failed: 0,
  };

  for (const code of codes) {
    // Cancellation check between countries.
    const { data: current } = await supabaseAdmin
      .from("party_backfill_runs")
      .select("status")
      .eq("id", runId)
      .single();
    if (current?.status === "cancelled") {
      await supabaseAdmin
        .from("party_backfill_country_runs")
        .update({ status: "cancelled" })
        .eq("run_id", runId)
        .eq("status", "queued");
      return;
    }

    const countryName = nameByCode.get(code) ?? code;
    await supabaseAdmin
      .from("party_backfill_country_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("run_id", runId)
      .eq("country_code", code);

    totals.attempted += 1;

    try {
      // Skip if already populated and not forced.
      if (!force) {
        const { count } = await supabaseAdmin
          .from("country_parties")
          .select("*", { count: "exact", head: true })
          .eq("country_code", code);
        if ((count ?? 0) > 0) {
          await supabaseAdmin
            .from("party_backfill_country_runs")
            .update({
              status: "succeeded",
              details: { skipped: true, reason: "already populated" },
              finished_at: new Date().toISOString(),
            })
            .eq("run_id", runId)
            .eq("country_code", code);
          await heartbeat(runId, totals);
          continue;
        }
      }

      const ctx = await buildCountryContext(supabaseAdmin, code);

      // Pass 1 — parties
      const p1 = await partiesPass({
        countryCode: code,
        countryName,
        ctx,
        actor: run.requested_by ?? undefined,
      });

      // Pass 2 — ruling
      const p2 = await rulingPass({
        countryCode: code,
        countryName,
        ctx,
        parties: p1.parties,
        actor: run.requested_by ?? undefined,
      });

      let partiesUpserted = 0;
      let rulingFlagged = false;
      let manifestoIngested = false;
      const details: Record<string, unknown> = {
        parties_pass: { count: p1.parties.length, notes: p1.notes },
        ruling_pass: { count: p2.ruling.length, cycle: p2.election_cycle, notes: p2.notes },
      };

      // Ensure the ruling lead's party is present in the parties list —
      // if the ruling pass names a party the enumeration missed, add a stub
      // row so we can still flag it.
      const leadName = p2.ruling.find((r) => r.coalition_role === "lead")?.party_name ?? null;
      if (leadName && !p1.parties.some((p) => partyNameMatches(p.name, leadName))) {
        p1.parties.push({
          name: leadName,
          abbreviation: null,
          leader_name: null,
          leader_role: null,
          ideology: null,
          founded_year: null,
          seats_current: null,
          seats_total: null,
          vote_share_pct: null,
          last_election_date: null,
          source_urls: p2.citations.map((c) => c.url).slice(0, 3),
        });
      }

      // ----- Persist parties -----
      if (!dryRun) {
        // Reset ruling flags first (idempotent re-run scenario).
        if (force) {
          await supabaseAdmin
            .from("country_parties")
            .update({ is_ruling: false, coalition_role: null })
            .eq("country_code", code);
        }

        for (const p of p1.parties) {
          const ruling = p2.ruling.find((r) => partyNameMatches(r.party_name, p.name));
          const row = {
            country_code: code,
            name: p.name,
            abbreviation: p.abbreviation,
            leader_name: p.leader_name,
            leader_role: p.leader_role,
            ideology: p.ideology,
            founded_year: p.founded_year,
            seats_current: p.seats_current,
            seats_total: p.seats_total,
            vote_share_pct: p.vote_share_pct,
            last_election_date: p.last_election_date,
            is_ruling: !!ruling,
            coalition_role: ruling?.coalition_role ?? null,
            source_urls: p.source_urls,
            confidence_grade: p.source_urls.length >= 2 ? "B" : "C",
            visibility: "public",
          };
          // country_parties has no simple onConflict on (country_code, lower(name)),
          // so upsert manually.
          const { data: existing } = await supabaseAdmin
            .from("country_parties")
            .select("id")
            .eq("country_code", code)
            .ilike("name", p.name)
            .maybeSingle();
          if (existing?.id) {
            const { error: uErr } = await supabaseAdmin
              .from("country_parties")
              .update(row)
              .eq("id", existing.id);
            if (uErr) throw new Error(`party update: ${uErr.message}`);
          } else {
            const { error: iErr } = await supabaseAdmin
              .from("country_parties")
              .insert(row);
            if (iErr) throw new Error(`party insert: ${iErr.message}`);
          }
          partiesUpserted += 1;
          if (ruling?.coalition_role === "lead") rulingFlagged = true;
        }
      } else {
        partiesUpserted = p1.parties.length;
        rulingFlagged = !!leadName;
      }

      // ----- Pass 3 + persist manifesto -----
      if (leadName) {
        const p3 = await manifestoPass({
          countryCode: code,
          countryName,
          ctx,
          rulingPartyName: leadName,
          electionCycle: p2.election_cycle,
          actor: run.requested_by ?? undefined,
        });
        details.manifesto_pass = {
          has_source: !!p3.source_url,
          pledges: p3.pledges.length,
          notes: p3.notes,
        };

        if (!dryRun && p3.source_url) {
          // Look up the persisted lead party id.
          const { data: leadRow } = await supabaseAdmin
            .from("country_parties")
            .select("id")
            .eq("country_code", code)
            .ilike("name", leadName)
            .maybeSingle();

          if (leadRow?.id) {
            // Register manifesto URL as a country_source (deduped).
            const src = await upsertCountrySource(supabaseAdmin, {
              country_code: code,
              url: p3.source_url,
              title: p3.title ?? `${leadName} manifesto`,
              org: leadName,
              kind: "manifesto",
              tags: ["auto", "manifesto", "party-backfill"],
              quality_score: 3,
              active: true,
            });

            // Ingest text into corpus chunks so Counsel/Ask can quote it.
            let documentId: string | null = null;
            if (src?.id && p3.source_text) {
              try {
                const hash = contentHash(p3.source_text);
                const { data: existingDoc } = await supabaseAdmin
                  .from("country_source_documents")
                  .select("id")
                  .eq("country_source_id", src.id)
                  .eq("content_hash", hash)
                  .maybeSingle();
                if (existingDoc?.id) {
                  documentId = existingDoc.id as string;
                } else {
                  const chunks = chunkText(p3.source_text);
                  if (chunks.length) {
                    const { data: docRow, error: dErr } = await supabaseAdmin
                      .from("country_source_documents")
                      .insert({
                        country_source_id: src.id,
                        raw_text: p3.source_text,
                        char_count: p3.source_text.length,
                        chunk_count: chunks.length,
                        content_hash: hash,
                      })
                      .select("id")
                      .single();
                    if (dErr || !docRow) throw new Error(dErr?.message ?? "doc insert failed");
                    documentId = docRow.id as string;

                    const vectors: number[][] = [];
                    for (let i = 0; i < chunks.length; i += 64) {
                      const embs = await embedBatch(chunks.slice(i, i + 64));
                      vectors.push(...embs);
                    }
                    const rows = chunks.map((c, idx) => ({
                      document_id: docRow.id,
                      country_code: code,
                      chunk_index: idx,
                      content: c,
                      embedding: `[${vectors[idx].join(",")}]`,
                    }));
                    for (let i = 0; i < rows.length; i += 100) {
                      await supabaseAdmin
                        .from("country_source_chunks")
                        .insert(rows.slice(i, i + 100));
                    }
                    manifestoIngested = true;
                  }
                }
              } catch (ingestErr) {
                details.manifesto_ingest_error = (ingestErr as Error).message.slice(0, 300);
              }
            }

            // Upsert the manifesto row.
            const cycleKey = p3.election_cycle ?? "current";
            const { data: existingManifesto } = await supabaseAdmin
              .from("country_manifestos")
              .select("id")
              .eq("country_code", code)
              .eq("party_id", leadRow.id)
              .eq("election_cycle", cycleKey)
              .maybeSingle();
            const manifestoRow = {
              country_code: code,
              party_id: leadRow.id,
              election_cycle: cycleKey,
              title: p3.title,
              summary: p3.summary,
              themes: p3.themes,
              pledges: p3.pledges,
              source_url: p3.source_url,
              source_document_id: documentId,
              citations: p3.citations,
              confidence_grade: p3.pledges.length >= 6 ? "B" : "C",
              visibility: "public",
            };
            if (existingManifesto?.id) {
              await supabaseAdmin
                .from("country_manifestos")
                .update(manifestoRow)
                .eq("id", existingManifesto.id);
            } else {
              await supabaseAdmin.from("country_manifestos").insert(manifestoRow);
            }

            // Seed a memory_object so the ruling programme surfaces in
            // Counsel prompts even before the chunks are queried.
            if (p3.summary) {
              await upsertMemoryObject({
                scope_key: "national",
                kind: "position",
                title: `Ruling party posture — ${leadName}`,
                payload: {
                  body: p3.summary,
                  themes: p3.themes,
                  pledges: p3.pledges.slice(0, 8),
                  source_url: p3.source_url,
                  election_cycle: cycleKey,
                },
                weight: 5,
                sector_code: "cross_cutting",
                source_id: src?.id ?? null,
              });
            }
          }
        }
      }

      totals.parties_upserted += partiesUpserted;
      if (rulingFlagged) totals.ruling_flagged += 1;
      if (manifestoIngested) totals.manifesto_ingested += 1;

      await supabaseAdmin
        .from("party_backfill_country_runs")
        .update({
          status: "succeeded",
          attempted: p1.parties.length,
          parties_upserted: partiesUpserted,
          ruling_flagged: rulingFlagged,
          manifesto_ingested: manifestoIngested,
          details,
          finished_at: new Date().toISOString(),
        })
        .eq("run_id", runId)
        .eq("country_code", code);

      await heartbeat(runId, totals);
    } catch (err) {
      totals.failed += 1;
      await supabaseAdmin
        .from("party_backfill_country_runs")
        .update({
          status: "failed",
          error: (err as Error).message.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("run_id", runId)
        .eq("country_code", code);
      await heartbeat(runId, totals);
    }
  }

  await supabaseAdmin
    .from("party_backfill_runs")
    .update({
      status: "succeeded",
      totals,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function heartbeat(runId: string, totals: Record<string, number>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("party_backfill_runs")
    .update({ totals, heartbeat_at: new Date().toISOString() })
    .eq("id", runId);
}
