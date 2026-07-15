// The ONE sanctioned corpus read gateway.
// Any read that would silently return `[]` on a miss MUST route through here.
// See .lovable/plan.md ("corpus-miss → deep external search → write-back").

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  CorpusDomain,
  CorpusCitation,
  CorpusReadResult,
  CorpusOutcome,
} from "./types";

const DEFAULT_COOLDOWN_MINUTES = 30;

export type CorpusSearchCtx = {
  countryCode: string;
  sector?: string;
  ministry?: string;
};

export type CorpusReadSpec<T> = {
  scope: CorpusSearchCtx;
  domain: CorpusDomain;
  /** Stable natural key for this fetch, used for dedup + cooldown. */
  key: string;
  /** Reads the corpus. Returns null / empty structure on miss. */
  read: () => Promise<T | null>;
  /** Given the read result, decide "empty enough to search". */
  isEmpty: (t: T | null) => boolean;
  /** Domain-appropriate external waterfall (memory/kpi/sector/…). */
  search: (ctx: CorpusSearchCtx) => Promise<{
    data: T;
    citations: CorpusCitation[];
    tier: string;
    notes?: string[];
  } | null>;
  /** Idempotent upsert of the search result back into the corpus. */
  writeBack: (t: T, citations: CorpusCitation[]) => Promise<void>;
  budget?: {
    maxMs?: number;
    forceRefresh?: boolean;
    cooldownMinutes?: number;
  };
  actor?: string | null;
};

async function isFallbackEnabled(): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "corpus_fallback_enabled")
      .maybeSingle();
    if (!data) return true;
    const v = (data as { value: unknown }).value;
    if (v === false || v === "false" || v === 0) return false;
    return true;
  } catch {
    return true;
  }
}

async function recentEmptyAttempt(
  countryCode: string,
  domain: CorpusDomain,
  key: string,
  cooldownMinutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMinutes * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("corpus_fetch_attempts")
    .select("id, outcome, created_at")
    .eq("country_code", countryCode)
    .eq("domain", domain)
    .eq("key", key)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0];
  if (!last) return false;
  return last.outcome === "empty" || last.outcome === "throttled" || last.outcome === "error";
}

async function logAttempt(row: {
  country_code: string;
  domain: CorpusDomain;
  key: string;
  outcome: CorpusOutcome;
  tier?: string | null;
  latency_ms: number;
  actor?: string | null;
  notes?: unknown;
}) {
  try {
    await supabaseAdmin.from("corpus_fetch_attempts").insert({
      country_code: row.country_code,
      domain: row.domain,
      key: row.key,
      outcome: row.outcome,
      tier: row.tier ?? null,
      latency_ms: row.latency_ms,
      actor: row.actor ?? null,
      ...(row.notes ? { notes: row.notes as never } : {}),
    });
  } catch {
    // Never let audit-logging failure break the gateway.
  }
}

export async function corpusRead<T>(spec: CorpusReadSpec<T>): Promise<CorpusReadResult<T>> {
  const t0 = Date.now();
  const cooldownMinutes = spec.budget?.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;

  // 1. Corpus first.
  const initial = await spec.read();
  if (!spec.isEmpty(initial) && !spec.budget?.forceRefresh) {
    const latency = Date.now() - t0;
    void logAttempt({
      country_code: spec.scope.countryCode,
      domain: spec.domain,
      key: spec.key,
      outcome: "hit",
      latency_ms: latency,
      actor: spec.actor ?? null,
    });
    return {
      data: initial as T,
      source: "corpus",
      outcome: "hit",
      provenance: {
        domain: spec.domain,
        key: spec.key,
        country_code: spec.scope.countryCode,
        latency_ms: latency,
      },
    };
  }

  // 2. Kill-switch + cooldown storm protection.
  const enabled = await isFallbackEnabled();
  if (!enabled) {
    const latency = Date.now() - t0;
    void logAttempt({
      country_code: spec.scope.countryCode,
      domain: spec.domain,
      key: spec.key,
      outcome: "throttled",
      latency_ms: latency,
      actor: spec.actor ?? null,
      notes: { reason: "kill_switch" },
    });
    return {
      data: (initial ?? (null as unknown as T)) as T,
      source: "empty",
      outcome: "throttled",
      provenance: {
        domain: spec.domain,
        key: spec.key,
        country_code: spec.scope.countryCode,
        latency_ms: latency,
        notes: ["Fallback disabled by app_settings.corpus_fallback_enabled"],
      },
    };
  }

  if (!spec.budget?.forceRefresh) {
    const recentEmpty = await recentEmptyAttempt(
      spec.scope.countryCode,
      spec.domain,
      spec.key,
      cooldownMinutes,
    );
    if (recentEmpty) {
      const latency = Date.now() - t0;
      void logAttempt({
        country_code: spec.scope.countryCode,
        domain: spec.domain,
        key: spec.key,
        outcome: "throttled",
        latency_ms: latency,
        actor: spec.actor ?? null,
        notes: { reason: "cooldown", cooldown_minutes: cooldownMinutes },
      });
      return {
        data: (initial ?? (null as unknown as T)) as T,
        source: "empty",
        outcome: "throttled",
        provenance: {
          domain: spec.domain,
          key: spec.key,
          country_code: spec.scope.countryCode,
          latency_ms: latency,
          notes: [`Cooldown active (${cooldownMinutes}m) after recent empty fetch.`],
        },
      };
    }
  }

  // 3. External waterfall.
  let searchResult: Awaited<ReturnType<typeof spec.search>> = null;
  try {
    const maxMs = spec.budget?.maxMs ?? 30_000;
    searchResult = await Promise.race([
      spec.search(spec.scope),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), maxMs)),
    ]);
  } catch (err) {
    const latency = Date.now() - t0;
    void logAttempt({
      country_code: spec.scope.countryCode,
      domain: spec.domain,
      key: spec.key,
      outcome: "error",
      latency_ms: latency,
      actor: spec.actor ?? null,
      notes: { error: (err as Error).message.slice(0, 400) },
    });
    return {
      data: (initial ?? (null as unknown as T)) as T,
      source: "empty",
      outcome: "error",
      provenance: {
        domain: spec.domain,
        key: spec.key,
        country_code: spec.scope.countryCode,
        latency_ms: latency,
        notes: [(err as Error).message.slice(0, 400)],
      },
    };
  }

  if (!searchResult || spec.isEmpty(searchResult.data)) {
    const latency = Date.now() - t0;
    void logAttempt({
      country_code: spec.scope.countryCode,
      domain: spec.domain,
      key: spec.key,
      outcome: "empty",
      tier: searchResult?.tier,
      latency_ms: latency,
      actor: spec.actor ?? null,
      notes: searchResult?.notes ? { notes: searchResult.notes } : null,
    });
    return {
      data: (initial ?? (null as unknown as T)) as T,
      source: "empty",
      outcome: "empty",
      tier: searchResult?.tier,
      provenance: {
        domain: spec.domain,
        key: spec.key,
        country_code: spec.scope.countryCode,
        latency_ms: latency,
        tier: searchResult?.tier,
        notes: searchResult?.notes,
      },
    };
  }

  // 4. Write-back (BEFORE returning, so next reader hits the corpus).
  try {
    await spec.writeBack(searchResult.data, searchResult.citations);
  } catch (err) {
    // Write-back failure doesn't hide the freshly-fetched data from the caller;
    // it just means the next reader will search again.
    void logAttempt({
      country_code: spec.scope.countryCode,
      domain: spec.domain,
      key: spec.key,
      outcome: "error",
      tier: searchResult.tier,
      latency_ms: Date.now() - t0,
      actor: spec.actor ?? null,
      notes: { writeback_error: (err as Error).message.slice(0, 400) },
    });
  }

  const latency = Date.now() - t0;
  void logAttempt({
    country_code: spec.scope.countryCode,
    domain: spec.domain,
    key: spec.key,
    outcome: "external",
    tier: searchResult.tier,
    latency_ms: latency,
    actor: spec.actor ?? null,
    notes: searchResult.notes ? { notes: searchResult.notes } : null,
  });
  return {
    data: searchResult.data,
    source: "external",
    outcome: "external",
    tier: searchResult.tier,
    citations: searchResult.citations,
    provenance: {
      domain: spec.domain,
      key: spec.key,
      country_code: spec.scope.countryCode,
      latency_ms: latency,
      tier: searchResult.tier,
      notes: searchResult.notes,
    },
  };
}

// ---------------------------------------------------------------------------
// Lightweight observability helper: instrument reads that don't yet have a
// domain-specific search waterfall wired up. Every runtime corpus read should
// call this so misses land in /admin/corpus-audit and the Ledger-QA corpus
// check.
//
// When a domain gets its own searcher, migrate the call site to `corpusRead`
// and drop `recordCorpusReadOutcome`.
// ---------------------------------------------------------------------------
export async function recordCorpusReadOutcome(params: {
  countryCode: string;
  domain: CorpusDomain;
  key: string;
  outcome: CorpusOutcome;
  latencyMs: number;
  actor?: string | null;
  tier?: string | null;
  notes?: unknown;
}): Promise<void> {
  await logAttempt({
    country_code: params.countryCode,
    domain: params.domain,
    key: params.key,
    outcome: params.outcome,
    latency_ms: params.latencyMs,
    actor: params.actor ?? null,
    tier: params.tier ?? null,
    notes: params.notes ?? null,
  });
}

// ---------------------------------------------------------------------------
// Fire-and-forget corpus backfill for callers that already have their (empty)
// read result and don't want to block the request on an external waterfall.
// Respects the same kill-switch + cooldown as `corpusRead`; on success the
// data lands in the corpus and the next read is a hit.
// ---------------------------------------------------------------------------
export function triggerCorpusBackfill<T>(spec: {
  scope: CorpusSearchCtx;
  domain: CorpusDomain;
  key: string;
  search: CorpusReadSpec<T>["search"];
  writeBack: CorpusReadSpec<T>["writeBack"];
  actor?: string | null;
  budget?: CorpusReadSpec<T>["budget"];
}): void {
  void corpusRead<T>({
    scope: spec.scope,
    domain: spec.domain,
    key: spec.key,
    read: async () => null as unknown as T,
    isEmpty: () => true,
    search: spec.search,
    writeBack: spec.writeBack,
    actor: spec.actor,
    budget: spec.budget,
  }).catch(() => {
    // Backfill errors are already logged inside corpusRead.
  });
}



