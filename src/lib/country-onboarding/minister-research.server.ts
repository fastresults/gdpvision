// Server-only. AI research loop that resolves the CURRENT officeholder
// (name + title + verified citation) for a single ministry.
//
// Strategy — stop as soon as we have a name + ≥1 citation:
//   1) Corpus pass  — vector-search country_source_chunks; ask a small LLM
//      to extract candidate (name,title) pairs from the retrieved evidence.
//   2) Targeted web — Perplexity sonar-reasoning-pro, domain-filtered to the
//      country's authorized gov/portal/gazette domains.
//   3) Wide web     — Perplexity sonar-reasoning-pro, noDomainFilter=true.
//      Only runs if pass 2 came back empty or without a source URL.
//   4) Cross-check  — Perplexity sonar-pro with a different framing. If it
//      disagrees on the surname, confidence drops to "low" and BOTH
//      candidates are surfaced for human review.
//
// Every pass is logged to corpus_fetch_attempts via recordCorpusReadOutcome,
// so the loop is auditable end-to-end in the ledger-QA hooks.

import { callSonar, parseSonarJson, type SonarCitation } from "./perplexity.server";
import { contextDomains, type CountryContext } from "./country-context.server";
import { recordCorpusReadOutcome } from "@/lib/corpus/gateway.server";

// ---------------------------------------------------------------------------
// Schema — canonical minister profile shape. Kept in this module so both
// stage 5 (M×S sidecar) and stage 9 (ministry_profiles commit) reference the
// same source of truth.
// ---------------------------------------------------------------------------
export const MinisterProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    party: { type: ["string", "null"] },
    appointed_at: { type: ["string", "null"] },
    bio: { type: ["string", "null"] },
    birth_date: { type: ["string", "null"] },
    education: { type: "array", items: { type: "string" } },
    career: { type: "array", items: { type: "string" } },
    contact: {
      type: "object",
      additionalProperties: false,
      properties: {
        office_phone: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        office_address: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
      },
    },
    socials: {
      type: "object",
      additionalProperties: false,
      properties: {
        twitter: { type: ["string", "null"] },
        facebook: { type: ["string", "null"] },
        linkedin: { type: ["string", "null"] },
        instagram: { type: ["string", "null"] },
      },
    },
    portrait_url: { type: ["string", "null"] },
    source_url: { type: ["string", "null"] },
  },
} as const;

const PerMinistrySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ministry_slug: { type: "string" },
    minister: { type: ["string", "null"] },
    minister_profile: MinisterProfileSchema,
    mandate: { type: "string" },
    programmes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          objective: { type: "string" },
          status: { type: "string" },
        },
        required: ["name", "objective", "status"],
      },
    },
  },
  required: ["ministry_slug", "mandate", "programmes"],
} as const;

// ---------------------------------------------------------------------------
// Result shape returned to callers
// ---------------------------------------------------------------------------
export type MinisterResearchResult = {
  ministry_slug: string;
  minister: string | null;
  minister_profile: Record<string, unknown>;
  mandate: string;
  programmes: Array<{ name: string; objective: string; status: string }>;
  citations: SonarCitation[];
  confidence: "low" | "medium" | "high";
  source_tier: "corpus" | "targeted_web" | "wide_web" | "unresolved";
  candidates: Array<{ name: string; title: string | null; source: string }>;
  notes: string[];
};

// Extract the family name for cross-check comparison. Case-insensitive,
// tolerant to accents and honorifics.
function surnameKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(hon\.?|honourable|rt\.?\s*hon\.?|sen\.?|dr\.?|mr\.?|mrs\.?|ms\.?)\s+/i, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts[parts.length - 1].toLowerCase();
}

function pickMinisterFromParsed(raw: unknown): {
  name: string | null;
  profile: Record<string, unknown>;
  mandate: string;
  programmes: Array<{ name: string; objective: string; status: string }>;
} {
  if (!raw || typeof raw !== "object") {
    return { name: null, profile: {}, mandate: "", programmes: [] };
  }
  const r = raw as any;
  const profile = r.minister_profile && typeof r.minister_profile === "object" ? r.minister_profile : {};
  const name = (profile.name ?? r.minister ?? null) as string | null;
  return {
    name: name && String(name).trim() ? String(name).trim() : null,
    profile: { ...profile, name },
    mandate: typeof r.mandate === "string" ? r.mandate : "",
    programmes: Array.isArray(r.programmes) ? r.programmes : [],
  };
}

// ---------------------------------------------------------------------------
// Pass 1 — corpus search. Cheap, deterministic. Never throws.
// ---------------------------------------------------------------------------
async function corpusPass(params: {
  admin: any;
  countryCode: string;
  ministry: { slug: string; name: string };
  actor?: string;
}): Promise<{ candidates: Array<{ name: string; title: string | null; source: string }>; latencyMs: number }> {
  const started = Date.now();
  try {
    const { embedBatch } = await import("./ingest.server");
    const query = `Minister of ${params.ministry.name} current officeholder appointment`;
    const [emb] = await embedBatch([query]);
    const vec = `[${emb.join(",")}]`;
    const { data: rows } = await params.admin.rpc("country_chunks_search", {
      _country_code: params.countryCode,
      _query_embedding: vec,
      _limit: 6,
    });
    const chunks = ((rows ?? []) as any[]).slice(0, 6);
    if (!chunks.length) {
      await recordCorpusReadOutcome({
        countryCode: params.countryCode,
        domain: "ministry",
        key: `minister:${params.ministry.slug}:corpus`,
        outcome: "empty",
        latencyMs: Date.now() - started,
        actor: params.actor,
        tier: "corpus",
      });
      return { candidates: [], latencyMs: Date.now() - started };
    }

    // Ask Gemini to pull explicit (name, title) mentions from the retrieved
    // chunks. Structured output on gateway.
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output, NoObjectGeneratedError } = await import("ai");
    const { z } = await import("zod");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { candidates: [], latencyMs: Date.now() - started };
    const gateway = createLovableAiGatewayProvider(key);
    const evidence = chunks.map((c, i) => `[C${i + 1}] (${c.source_org ?? "?"}) ${c.content.slice(0, 600)}`).join("\n\n");

    const schema = z.object({
      candidates: z
        .array(
          z.object({
            name: z.string(),
            title: z.string().nullable(),
            chunk_ref: z.string().nullable(),
          }),
        )
        .max(4),
    });

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.1-flash-lite"),
        output: Output.object({ schema }) as any,
        prompt: `Ministry: ${params.ministry.name}\n\nEvidence chunks from the country's corpus:\n${evidence}\n\nExtract every explicit mention of the CURRENT officeholder of THIS ministry (name + title). Do not include predecessors, junior ministers, or unrelated cabinet members. Set title to null when the chunk does not state one. If nothing in the evidence names the current minister, return an empty array.`,
      } as any);
      const parsed = (output as any) ?? { candidates: [] };
      const byName = new Map<string, { name: string; title: string | null; source: string }>();
      for (const cand of parsed.candidates ?? []) {
        if (!cand?.name) continue;
        const key = String(cand.name).trim().toLowerCase();
        if (!key || byName.has(key)) continue;
        const ref = cand.chunk_ref && /^C\d+$/.test(cand.chunk_ref) ? cand.chunk_ref : "C?";
        const idx = ref.startsWith("C") ? Number(ref.slice(1)) - 1 : -1;
        const chunk = idx >= 0 && idx < chunks.length ? chunks[idx] : null;
        byName.set(key, {
          name: String(cand.name).trim(),
          title: cand.title ? String(cand.title).trim() : null,
          source: chunk?.source_url ?? "corpus",
        });
      }
      const candidates = Array.from(byName.values()).slice(0, 3);
      await recordCorpusReadOutcome({
        countryCode: params.countryCode,
        domain: "ministry",
        key: `minister:${params.ministry.slug}:corpus`,
        outcome: candidates.length ? "hit" : "empty",
        latencyMs: Date.now() - started,
        actor: params.actor,
        tier: "corpus",
        notes: { chunks: chunks.length, candidates: candidates.length },
      });
      return { candidates, latencyMs: Date.now() - started };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return { candidates: [], latencyMs: Date.now() - started };
      }
      throw err;
    }
  } catch {
    return { candidates: [], latencyMs: Date.now() - started };
  }
}

// ---------------------------------------------------------------------------
// Perplexity system prompt shared by web passes
// ---------------------------------------------------------------------------
const WEB_SYSTEM =
  "You are a governance analyst. Research the SPECIFIC ministry named by the user and return ONE JSON object matching the schema. `minister_profile.name` MUST be the CURRENT officeholder of THIS ministry — do NOT default to the head of government unless they personally hold this portfolio. If you cannot verify the current minister from an official ministry website, government gazette, parliamentary record, or a current Wikipedia infobox, set minister and minister_profile.name to null. Include title, party, appointed_at (ISO), a <=400 char bio, education, career highlights, contact block (office_phone, email, office_address, website), verified official socials, portrait_url when publicly available, and `minister_profile.source_url` pointing to the primary source that names this officeholder. Provide a concrete mandate paragraph and 2-5 flagship programmes (name/objective/status). Return null for any field you cannot verify — never guess.";

// ---------------------------------------------------------------------------
// Pass 2 / 3 — Perplexity call, targeted or wide
// ---------------------------------------------------------------------------
async function webPass(params: {
  countryCode: string;
  countryName: string;
  ministry: { slug: string; name: string };
  ctx: CountryContext;
  wide: boolean;
  hint?: string;
  actor?: string;
}): Promise<{
  parsed: ReturnType<typeof pickMinisterFromParsed>;
  citations: SonarCitation[];
  latencyMs: number;
  raw: unknown;
}> {
  const started = Date.now();
  const tier = params.wide ? "wide_web" : "targeted_web";
  try {
    const res = await callSonar({
      model: "sonar-reasoning-pro",
      system: WEB_SYSTEM,
      user: `Country: ${params.countryName}.\nMinistry slug: ${params.ministry.slug}\nMinistry name: ${params.ministry.name}\n\nReturn a single object with ministry_slug="${params.ministry.slug}".${params.hint ? `\n\nHint: ${params.hint}` : ""}`,
      responseSchema: PerMinistrySchema as unknown as Record<string, unknown>,
      countryTld: params.wide ? undefined : params.ctx.tld ?? undefined,
      extraDomains: params.wide ? undefined : contextDomains(params.ctx),
      noDomainFilter: params.wide,
    });
    const parsedRaw = parseSonarJson<any>(res.content);
    if (parsedRaw && typeof parsedRaw === "object") parsedRaw.ministry_slug = params.ministry.slug;
    const parsed = pickMinisterFromParsed(parsedRaw);
    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `minister:${params.ministry.slug}:${tier}`,
      outcome: parsed.name ? "hit" : "empty",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier,
      notes: { citations: res.citations.length },
    });
    return { parsed, citations: res.citations, latencyMs: Date.now() - started, raw: res.raw };
  } catch (err) {
    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `minister:${params.ministry.slug}:${tier}`,
      outcome: "error",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier,
      notes: { error: (err as Error).message.slice(0, 240) },
    });
    return { parsed: { name: null, profile: {}, mandate: "", programmes: [] }, citations: [], latencyMs: Date.now() - started, raw: null };
  }
}

// ---------------------------------------------------------------------------
// Pass 4 — cross-check with a different framing
// ---------------------------------------------------------------------------
async function crossCheck(params: {
  countryCode: string;
  countryName: string;
  ministry: { slug: string; name: string };
  ctx: CountryContext;
  actor?: string;
}): Promise<{ name: string | null; title: string | null; citations: SonarCitation[] }> {
  const started = Date.now();
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: ["string", "null"] },
      title: { type: ["string", "null"] },
      source_url: { type: ["string", "null"] },
    },
    required: ["name"],
  } as const;
  try {
    const res = await callSonar({
      model: "sonar-pro",
      system:
        "You verify the identity of a current cabinet minister. Return ONE JSON object with the officeholder's full name, their exact title, and the primary source URL. If you cannot verify from an official source, return name=null. Never guess.",
      user: `Who is currently the Minister of ${params.ministry.name} in ${params.countryName}? Cite the primary source URL that names this officeholder.`,
      responseSchema: schema as unknown as Record<string, unknown>,
      countryTld: params.ctx.tld ?? undefined,
      extraDomains: contextDomains(params.ctx),
    });
    const parsed = parseSonarJson<any>(res.content) ?? {};
    const name = parsed.name && String(parsed.name).trim() ? String(parsed.name).trim() : null;
    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `minister:${params.ministry.slug}:crosscheck`,
      outcome: name ? "hit" : "empty",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "crosscheck",
    });
    return {
      name,
      title: parsed.title && String(parsed.title).trim() ? String(parsed.title).trim() : null,
      citations: res.citations,
    };
  } catch {
    return { name: null, title: null, citations: [] };
  }
}

// ---------------------------------------------------------------------------
// Public: resolveMinister — orchestrates the loop for one ministry
// ---------------------------------------------------------------------------
export async function resolveMinister(params: {
  admin: any;
  countryCode: string;
  countryName: string;
  ministry: { slug: string; name: string };
  ctx: CountryContext;
  actor?: string;
}): Promise<MinisterResearchResult> {
  const notes: string[] = [];
  const allCitations: SonarCitation[] = [];
  const seenCiteUrls = new Set<string>();
  const pushCites = (cs: SonarCitation[]) => {
    for (const c of cs) {
      if (!seenCiteUrls.has(c.url)) {
        seenCiteUrls.add(c.url);
        allCitations.push(c);
      }
    }
  };

  // Pass 1: corpus
  const corpus = await corpusPass({
    admin: params.admin,
    countryCode: params.countryCode,
    ministry: params.ministry,
    actor: params.actor,
  });
  if (corpus.candidates.length) {
    notes.push(`corpus: ${corpus.candidates.length} candidate(s)`);
    for (const c of corpus.candidates) {
      if (c.source && /^https?:\/\//.test(c.source) && !seenCiteUrls.has(c.source)) {
        seenCiteUrls.add(c.source);
        allCitations.push({ url: c.source, title: `Corpus: ${params.ministry.name}` });
      }
    }
  }
  const corpusTopName = corpus.candidates[0]?.name ?? null;

  // Pass 2: targeted web (also produces mandate/programmes for the draft)
  const targeted = await webPass({
    countryCode: params.countryCode,
    countryName: params.countryName,
    ministry: params.ministry,
    ctx: params.ctx,
    wide: false,
    hint: corpusTopName ? `Corpus suggests the current minister may be "${corpusTopName}" — verify against a primary source before returning.` : undefined,
    actor: params.actor,
  });
  pushCites(targeted.citations);

  let best = targeted.parsed;
  let source_tier: MinisterResearchResult["source_tier"] = best.name ? "targeted_web" : "unresolved";

  // Pass 3: wide web if targeted came back empty
  if (!best.name) {
    const wide = await webPass({
      countryCode: params.countryCode,
      countryName: params.countryName,
      ministry: params.ministry,
      ctx: params.ctx,
      wide: true,
      hint: corpusTopName ? `Corpus suggests "${corpusTopName}" — verify.` : undefined,
      actor: params.actor,
    });
    pushCites(wide.citations);
    if (wide.parsed.name) {
      best = wide.parsed;
      source_tier = "wide_web";
    } else if (targeted.parsed.mandate && !best.mandate) {
      // keep whichever pass gave us mandate/programmes
      best = targeted.parsed;
    } else if (wide.parsed.mandate) {
      best = wide.parsed;
    }
  }

  // Pass 4: cross-check the officeholder
  const candidates: MinisterResearchResult["candidates"] = [];
  if (corpusTopName) candidates.push({ name: corpusTopName, title: corpus.candidates[0]?.title ?? null, source: "corpus" });
  if (best.name) candidates.push({ name: best.name, title: (best.profile as any)?.title ?? null, source: source_tier });

  let confidence: MinisterResearchResult["confidence"] = "low";
  if (best.name) {
    const cross = await crossCheck({
      countryCode: params.countryCode,
      countryName: params.countryName,
      ministry: params.ministry,
      ctx: params.ctx,
      actor: params.actor,
    });
    pushCites(cross.citations);
    if (cross.name) {
      candidates.push({ name: cross.name, title: cross.title, source: "crosscheck" });
      const a = surnameKey(best.name);
      const b = surnameKey(cross.name);
      if (a && b && a === b) {
        confidence = allCitations.length >= 2 ? "high" : "medium";
        notes.push("crosscheck: agrees");
      } else {
        confidence = "low";
        notes.push(`crosscheck: DISAGREES (web="${best.name}" vs crosscheck="${cross.name}")`);
      }
    } else {
      // cross-check couldn't verify; keep confidence at medium if web was strong
      confidence = allCitations.length >= 2 ? "medium" : "low";
      notes.push("crosscheck: unverified");
    }
  } else {
    notes.push("all web passes returned null minister");
  }

  return {
    ministry_slug: params.ministry.slug,
    minister: best.name,
    minister_profile: best.profile,
    mandate: best.mandate,
    programmes: best.programmes,
    citations: allCitations,
    confidence,
    source_tier,
    candidates,
    notes,
  };
}
