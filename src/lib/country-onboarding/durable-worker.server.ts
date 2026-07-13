import type { Stage } from "./orchestrator.functions";

const STAGE_ORDER: Stage[] = [
  "profile",
  "gdp",
  "sector_composition",
  "ministries",
  "source_registry",
  "kpi_seed",
  "ministry_sector_map",
  "sector_dossier",
  "ministry_deep_dive",
  "corpus_ingest",
  "second_brain_seed",
  "capital_flows",
];

const TERMINAL = ["completed", "failed", "cancelled", "skipped", "needs_review", "blocked", "stale"];
const CHILD_STEP_TYPES: Partial<Record<Stage, string>> = {
  ministry_deep_dive: "ministry",
  corpus_ingest: "source",
};

function isFreshRunning(row: any) {
  return row.status === "running" && row.heartbeat_at && Date.now() - new Date(row.heartbeat_at).getTime() < 15 * 60 * 1000;
}

function simpleSlug(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function normalizeMemoryTitle(title: string) {
  return String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

function citationFromUrl(url: string, title?: string | null) {
  let domain: string | null = null;
  try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* validated earlier */ }
  return { url, domain, title: title ?? domain ?? "Source" };
}

async function loadCountry(admin: any, code: string) {
  const { data, error } = await admin
    .from("countries")
    .select("code, name, iso3, currency, gdp_current_usd")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) throw new Error(`Country ${code} not found`);
  return data as { code: string; name: string; iso3: string | null; currency: string; gdp_current_usd: number | null };
}

async function countCommitted(admin: any, countryCode: string, stage: Stage): Promise<number> {
  const count = async (q: any) => {
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };
  if (stage === "profile" || stage === "gdp") {
    const { data } = await admin.from("countries").select("profile_committed_at, gdp_committed_at").eq("code", countryCode).maybeSingle();
    return stage === "profile" ? (data?.profile_committed_at ? 1 : 0) : (data?.gdp_committed_at ? 1 : 0);
  }
  if (stage === "sector_composition") return count(admin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "ministries") return count(admin.from("ministries").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "source_registry") return count(admin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "kpi_seed") return count(admin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "ministry_sector_map") {
    return count(admin.from("ministry_sectors").select("ministry_id, ministries!inner(country_code)", { count: "exact", head: true }).eq("ministries.country_code", countryCode));
  }
  if (stage === "sector_dossier") return count(admin.from("sector_dossiers").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "ministry_deep_dive") return count(admin.from("ministry_profiles").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "corpus_ingest") return count(admin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "second_brain_seed") return count(admin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", countryCode));
  if (stage === "capital_flows") return count(admin.from("country_capital_flows").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  return 0;
}

async function openLegacyRun(admin: any, params: { countryCode: string; stage: Stage; userId: string | null; modelStack: Record<string, string> }) {
  // Durable steps are the owner for their stage. If a prior attempt died after
  // opening the legacy progress row but before finishing it, clear that lock
  // immediately so resume/retry is real instead of waiting 15+ minutes.
  await admin
    .from("onboarding_runs")
    .update({ status: "stale", finished_at: new Date().toISOString(), error: "durable worker recovery: superseded open run" })
    .eq("country_code", params.countryCode)
    .eq("stage", params.stage)
    .in("status", ["queued", "planning", "searching", "extracting", "validating"]);

  const { data, error } = await admin
    .from("onboarding_runs")
    .insert({
      country_code: params.countryCode,
      stage: params.stage,
      status: "planning",
      started_by: params.userId,
      model_stack: params.modelStack,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function writeEvent(admin: any, args: { jobId: string; stepId?: string; countryCode: string; eventType: string; message?: string; payload?: unknown }) {
  await admin.from("onboarding_job_events").insert({
    job_id: args.jobId,
    step_id: args.stepId ?? null,
    country_code: args.countryCode,
    event_type: args.eventType,
    message: args.message ?? null,
    payload: (args.payload ?? {}) as any,
  });
}

async function refreshJobStatus(admin: any, jobId: string) {
  const { data: steps } = await admin.from("onboarding_job_steps").select("stage, status, error, output").eq("job_id", jobId);
  const rows = [...(steps ?? [])].sort((a: any, b: any) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  const counts = rows.reduce((acc: Record<string, number>, s: any) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const done = rows.filter((s: any) => TERMINAL.includes(s.status)).length;
  const failed = rows.find((s: any) => s.status === "failed");
  const blocked = rows.find((s: any) => s.status === "blocked");
  const running = rows.find((s: any) => s.status === "running");
  const queued = rows.find((s: any) => s.status === "queued");
  let status = "running";
  if (failed) status = "failed";
  else if (blocked && !queued && !running) status = "blocked";
  else if (done === rows.length) status = "completed";
  const current = running?.stage ?? queued?.stage ?? blocked?.stage ?? null;
  await admin.from("onboarding_jobs").update({
    status,
    current_stage: current,
    heartbeat_at: new Date().toISOString(),
    progress: { total: rows.length, done, counts, currentStage: current, updatedAt: new Date().toISOString() },
    error: failed?.error ?? blocked?.error ?? null,
    finished_at: status === "completed" || status === "failed" || status === "blocked" ? new Date().toISOString() : null,
  }).eq("id", jobId);
}

async function nextRunnableStep(admin: any, job: any) {
  const { data: steps } = await admin
    .from("onboarding_job_steps")
    .select("*")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });
  const rows = steps ?? [];
  for (const stage of STAGE_ORDER) {
    if (stage === "kpi_seed") {
      const parent = rows.find((s: any) => s.stage === "kpi_seed" && s.step_key === "kpi_seed");
      if (!parent || TERMINAL.includes(parent.status)) continue;
      const children = rows.filter((s: any) => s.stage === "kpi_seed" && s.step_type === "kpi");
      const freshRunningChild = children.find(
        (s: any) => s.status === "running" && s.heartbeat_at && Date.now() - new Date(s.heartbeat_at).getTime() < 15 * 60 * 1000,
      );
      if (freshRunningChild) return null;
      const child = children.find((s: any) => {
        if (TERMINAL.includes(s.status)) return false;
        if (s.status === "running" && s.heartbeat_at && Date.now() - new Date(s.heartbeat_at).getTime() < 15 * 60 * 1000) return false;
        return true;
      });
      if (child) return child;
      if (children.length > 0 && children.every((s: any) => TERMINAL.includes(s.status))) return parent;
      if (parent.status === "running" && parent.heartbeat_at && Date.now() - new Date(parent.heartbeat_at).getTime() < 15 * 60 * 1000) return null;
      return parent;
    }

    const childType = CHILD_STEP_TYPES[stage];
    if (childType) {
      const parent = rows.find((s: any) => s.stage === stage && s.step_key === stage);
      if (!parent || TERMINAL.includes(parent.status)) continue;
      const children = rows.filter((s: any) => s.stage === stage && s.step_type === childType);
      if (children.some(isFreshRunning)) return null;
      const child = children.find((s: any) => !TERMINAL.includes(s.status) && !isFreshRunning(s));
      if (child) return child;
      if (children.length > 0 && children.every((s: any) => TERMINAL.includes(s.status))) return parent;
      if (isFreshRunning(parent)) return null;
      return parent;
    }

    const step = rows.find((s: any) => s.stage === stage && s.step_key === stage);
    if (!step) continue;
    if (TERMINAL.includes(step.status)) continue;
    if (step.status === "running" && step.heartbeat_at && Date.now() - new Date(step.heartbeat_at).getTime() < 15 * 60 * 1000) return null;
    return step;
  }
  return null;
}

async function executeMinistrySectorMap(admin: any, job: any, step: any) {
  const { data: ministries, error: mErr } = await admin.from("ministries").select("slug").eq("country_code", job.country_code);
  if (mErr) throw mErr;
  const { data: sectors, error: sErr } = await admin.from("country_sectors").select("sector_code").eq("country_code", job.country_code);
  if (sErr) throw sErr;
  if (!ministries?.length) throw new Error("Ministry-sector map requires committed ministries");
  if (!sectors?.length) throw new Error("Ministry-sector map requires committed sector composition");
  const { seedMinistrySectorMap } = await import("./seeds.server");
  const rows = seedMinistrySectorMap(
    ministries.map((m: any) => String(m.slug)),
    sectors.map((s: any) => String(s.sector_code)),
  );
  if (!rows.length) throw new Error("No ministry-sector mappings could be generated from committed ministries/sectors");
  const { error } = await admin.rpc("replace_ministry_sectors", { _country_code: job.country_code, _rows: rows as any });
  if (error) throw error;
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output: { inserted: rows.length, method: "deterministic-portfolio-map" },
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", step.id);
  return { status: "completed", stage: "ministry_sector_map", inserted: rows.length };
}

async function executeSectorDossier(admin: any, job: any, step: any) {
  const { callSonar, parseSonarJson } = await import("./perplexity.server");
  const country = await loadCountry(admin, job.country_code);
  const { data: sectors, error: sErr } = await admin.from("country_sectors").select("sector_code").eq("country_code", job.country_code);
  if (sErr) throw sErr;
  const sectorCodes = (sectors ?? []).map((s: any) => String(s.sector_code));
  if (!sectorCodes.length) throw new Error("Sector dossier requires committed sector composition");
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      dossiers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sector_code: { type: "string" },
            policy: {
              type: "object",
              additionalProperties: false,
              properties: {
                statutes: { type: "array", items: { type: "string" } },
                institutions: { type: "array", items: { type: "string" } },
                national_plans: { type: "array", items: { type: "string" } },
                regulatory_instruments: { type: "array", items: { type: "string" } },
              },
              required: ["statutes", "institutions", "national_plans", "regulatory_instruments"],
            },
            comms: {
              type: "object",
              additionalProperties: false,
              properties: {
                channels: { type: "array", items: { type: "string" } },
                spokespeople: { type: "array", items: { type: "string" } },
                narratives: { type: "array", items: { type: "string" } },
                reputation_risks: { type: "array", items: { type: "string" } },
              },
              required: ["channels", "spokespeople", "narratives", "reputation_risks"],
            },
            regional_benchmark: {
              type: "object",
              additionalProperties: false,
              properties: {
                peers: { type: "array", items: { type: "string" } },
                position: { type: "string", enum: ["leader", "average", "laggard"] },
                rationale: { type: "string" },
              },
              required: ["peers", "position", "rationale"],
            },
          },
          required: ["sector_code", "policy", "comms", "regional_benchmark"],
        },
      },
    },
    required: ["dossiers"],
  } as const;
  const runId = await openLegacyRun(admin, {
    countryCode: job.country_code,
    stage: "sector_dossier",
    userId: job.started_by ?? null,
    modelStack: { durable: "stage", perplexity: "sonar-reasoning-pro" },
  });
  let parsed: { dossiers?: any[] } | null = null;
  let citations: Array<{ url: string; title: string | null; domain: string | null }> = [];
  let fallbackReason: string | null = null;
  try {
    const result = await callSonar({
      model: "sonar-reasoning-pro",
      system: "You are a sovereign sector analyst. Return concrete policy, communications, and regional benchmark dossiers for the requested sectors. Use real institutions, plans, statutory instruments, channels, spokespeople, and peer references when available. Return JSON only.",
      user: `Country: ${country.name} (${country.iso3 ?? country.code}). Sector codes: ${sectorCodes.join(", ")}. Return one dossier per sector_code.`,
      responseSchema: schema as unknown as Record<string, unknown>,
      maxTokens: 6000,
    });
    parsed = parseSonarJson<{ dossiers?: any[] }>(result.content);
    citations = result.citations.map((c) => ({ url: c.url, title: c.title ?? null, domain: c.domain ?? null }));
  } catch (err) {
    fallbackReason = (err as Error).message ?? String(err);
  }
  if (!parsed?.dossiers?.length) {
    fallbackReason ??= "Sector dossier research returned no dossiers";
    const reason = fallbackReason;
    parsed = {
      dossiers: sectorCodes.map((sectorCode: string) => ({
        sector_code: sectorCode,
        policy: {
          statutes: [],
          institutions: [`${country.name} line ministries and statutory bodies`],
          national_plans: [`${country.name} national development and budget planning instruments`],
          regulatory_instruments: [],
        },
        comms: {
          channels: ["Cabinet briefings", "Government information service", "Ministry notices"],
          spokespeople: ["Responsible minister", "Permanent secretary"],
          narratives: [`${sectorCode} delivery and resilience`],
          reputation_risks: ["Evidence gaps require manual review before public use"],
        },
        regional_benchmark: {
          peers: ["OECS", "CARICOM small states"],
          position: "average",
          rationale: `Provisional benchmark generated because live research failed: ${reason.slice(0, 180)}`,
        },
      })),
    };
  }
  const dossiers = parsed.dossiers ?? [];
  let upserted = 0;
  for (const d of dossiers) {
    if (!sectorCodes.includes(String(d.sector_code))) continue;
    for (const kind of ["policy", "comms", "oecs"] as const) {
      const payload = kind === "oecs" ? d.regional_benchmark : d[kind];
      if (!payload) continue;
      const { error } = await admin.from("sector_dossiers").upsert({
        country_code: job.country_code,
        sector_code: d.sector_code,
        kind,
        payload,
        source_ids: [],
        citations,
        confidence: citations.length >= 2 ? "medium" : "low",
      }, { onConflict: "country_code,sector_code,kind" });
      if (error) throw error;
      upserted++;
    }
  }
  await admin.from("onboarding_runs").update({ status: "committed", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId);
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output: { upserted, dossiers: dossiers.length, citations: citations.length, runId, fallbackReason },
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", step.id);
  return { status: "completed", stage: "sector_dossier", upserted };
}

async function expandMinistryDeepDive(admin: any, job: any, parent: any) {
  const { data: ministries, error } = await admin.from("ministries").select("slug, name").eq("country_code", job.country_code).order("sort_order");
  if (error) throw error;
  if (!ministries?.length) throw new Error("Ministry deep-dive requires committed ministries");
  const children = ministries.map((m: any, order: number) => ({
    job_id: job.id,
    country_code: job.country_code,
    stage: "ministry_deep_dive",
    step_key: `ministry:${m.slug}`,
    step_type: "ministry",
    status: "queued",
    checkpoint: { order, ministry_slug: m.slug, ministry_name: m.name },
    output: {},
  }));
  const { error: upErr } = await admin.from("onboarding_job_steps").upsert(children, { onConflict: "job_id,stage,step_key" });
  if (upErr) throw upErr;
  await admin.from("onboarding_job_steps").update({
    status: "running",
    checkpoint: { ...(parent.checkpoint ?? {}), expanded: true, totalMinistries: ministries.length },
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: "expanded", stage: "ministry_deep_dive", totalMinistries: ministries.length };
}

async function executeMinistryChild(admin: any, job: any, step: any) {
  const { callSonar, parseSonarJson } = await import("./perplexity.server");
  const country = await loadCountry(admin, job.country_code);
  const ministrySlug = String(step.checkpoint?.ministry_slug ?? step.step_key.replace(/^ministry:/, ""));
  const ministryName = String(step.checkpoint?.ministry_name ?? ministrySlug);
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      ministry_slug: { type: "string" },
      minister: { type: ["string", "null"] },
      minister_profile: {
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
        },
      },
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
  let parsed: any = null;
  let citations: Array<{ url: string; title: string | null; domain: string | null }> = [];
  let fallbackReason: string | null = null;
  try {
    const result = await callSonar({
      model: "sonar-pro",
      noDomainFilter: true,
      system: "You are a governance analyst. Research exactly one ministry and return JSON. Verify the current officeholder where possible from official, parliamentary, gazette, or current public records; set unknown identity fields to null rather than guessing. Include mandate and 2-5 flagship programmes.",
      user: `Country: ${country.name}. Ministry slug: ${ministrySlug}. Ministry name: ${ministryName}. Return ministry_slug exactly as '${ministrySlug}'.`,
      responseSchema: schema as unknown as Record<string, unknown>,
      maxTokens: 2500,
    });
    parsed = parseSonarJson<any>(result.content);
    citations = result.citations.map((c) => ({ url: c.url, title: c.title ?? null, domain: c.domain ?? null }));
  } catch (err) {
    fallbackReason = (err as Error).message ?? String(err);
  }
  if (!parsed || typeof parsed !== "object") {
    parsed = {
      ministry_slug: ministrySlug,
      minister: null,
      minister_profile: { name: null, title: null, party: null, appointed_at: null, bio: null, birth_date: null, education: [], career: [], contact: {}, socials: {}, portrait_url: null },
      mandate: `${ministryName} mandate pending source verification. Durable fallback used because live research failed: ${(fallbackReason ?? "no result").slice(0, 180)}`,
      programmes: [],
    };
  }
  const profile = parsed.minister_profile && typeof parsed.minister_profile === "object" ? parsed.minister_profile : {};
  const resolvedName = profile.name ?? parsed.minister ?? null;
  const { error } = await admin.from("ministry_profiles").upsert({
    country_code: job.country_code,
    ministry_slug: ministrySlug,
    minister: resolvedName,
    minister_profile: { ...profile, name: resolvedName },
    mandate: parsed.mandate ?? `${ministryName} mandate pending verification.`,
    programmes: Array.isArray(parsed.programmes) ? parsed.programmes : [],
    source_ids: [],
    citations,
  }, { onConflict: "country_code,ministry_slug" });
  if (error) throw error;
  const output = { ministry_slug: ministrySlug, minister: resolvedName, citations: citations.length, programmes: Array.isArray(parsed.programmes) ? parsed.programmes.length : 0, fallbackReason };
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", step.id);
  return { status: "completed", stage: "ministry_deep_dive", ministry: ministrySlug };
}

async function finalizeChildStage(admin: any, job: any, parent: any, childType: string, outputKey: string) {
  const { data: children } = await admin
    .from("onboarding_job_steps")
    .select("status, output, error")
    .eq("job_id", job.id)
    .eq("stage", parent.stage)
    .eq("step_type", childType);
  const rows = children ?? [];
  if (!rows.length) {
    if (parent.stage === "ministry_deep_dive") return expandMinistryDeepDive(admin, job, parent);
    return expandCorpusIngest(admin, job, parent);
  }
  if (!rows.every((s: any) => TERMINAL.includes(s.status))) return { status: "running", stage: parent.stage };
  const completed = rows.filter((s: any) => s.status === "completed").length;
  await admin.from("onboarding_job_steps").update({
    status: completed > 0 ? "completed" : "failed",
    output: { total: rows.length, completed, [outputKey]: rows.map((r: any) => r.output).filter(Boolean) },
    error: completed > 0 ? null : `No ${childType} child steps completed`,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: completed > 0 ? "completed" : "failed", stage: parent.stage, completed, total: rows.length };
}

async function expandCorpusIngest(admin: any, job: any, parent: any) {
  const { data: sources, error } = await admin
    .from("country_sources")
    .select("id, url, title")
    .eq("country_code", job.country_code)
    .eq("active", true)
    .order("quality_score", { ascending: false })
    .limit(25);
  if (error) throw error;
  if (!sources?.length) throw new Error("Corpus ingest requires active country sources");
  const invalid = sources.filter((s: any) => !isValidHttpUrl(s.url));
  if (invalid.length) {
    await admin.from("country_sources").update({ active: false, fetch_status: "invalid_url", fetch_error: "not a valid http(s) URL" }).in("id", invalid.map((s: any) => s.id));
  }
  const valid = sources.filter((s: any) => isValidHttpUrl(s.url));
  if (!valid.length) throw new Error("Corpus ingest found no valid active source URLs");
  const children = valid.map((s: any, order: number) => ({
    job_id: job.id,
    country_code: job.country_code,
    stage: "corpus_ingest",
    step_key: `source:${s.id}`,
    step_type: "source",
    status: "queued",
    checkpoint: { order, source_id: s.id, url: s.url, title: s.title },
    output: {},
  }));
  const { error: upErr } = await admin.from("onboarding_job_steps").upsert(children, { onConflict: "job_id,stage,step_key" });
  if (upErr) throw upErr;
  await admin.from("onboarding_job_steps").update({
    status: "running",
    checkpoint: { ...(parent.checkpoint ?? {}), expanded: true, totalSources: valid.length, invalidSources: invalid.length },
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: "expanded", stage: "corpus_ingest", totalSources: valid.length, invalidSources: invalid.length };
}

async function executeCorpusSourceChild(admin: any, job: any, step: any) {
  const { fetchFirecrawl, chunkText, embedBatch } = await import("./ingest.server");
  const sourceId = String(step.checkpoint?.source_id ?? step.step_key.replace(/^source:/, ""));
  const url = String(step.checkpoint?.url ?? "");
  if (!isValidHttpUrl(url)) throw new Error("Source URL is not a valid http(s) URL");
  try {
    const doc = await fetchFirecrawl(url);
    if (!doc.markdown || doc.markdown.length < 200) throw new Error(`too short: ${doc.markdown.length} chars`);
    const { contentHash } = await import("./memory-dedup.server");
    const hash = contentHash(doc.markdown);
    const { data: existing } = await admin.from("country_source_documents").select("id").eq("country_source_id", sourceId).eq("content_hash", hash).maybeSingle();
    if (existing) {
      await admin.from("country_sources").update({ last_fetched_at: new Date().toISOString(), fetch_status: "ok", fetch_error: null }).eq("id", sourceId);
      await admin.from("onboarding_job_steps").update({ status: "completed", output: { source_id: sourceId, url, chunks: 0, reused: true }, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
      return { status: "completed", stage: "corpus_ingest", source: sourceId, reused: true };
    }
    const chunks = chunkText(doc.markdown);
    if (!chunks.length) throw new Error("no chunks after split");
    const { data: docRow, error: dErr } = await admin.from("country_source_documents").insert({
      country_source_id: sourceId,
      raw_text: doc.markdown,
      char_count: doc.markdown.length,
      chunk_count: chunks.length,
      content_hash: hash,
    }).select("id").single();
    if (dErr || !docRow) throw new Error(dErr?.message ?? "document insert failed");
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += 64) vectors.push(...await embedBatch(chunks.slice(i, i + 64)));
    const rows = chunks.map((content, idx) => ({ document_id: docRow.id, country_code: job.country_code, chunk_index: idx, content, embedding: `[${vectors[idx].join(",")}]` }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("country_source_chunks").insert(rows.slice(i, i + 100));
      if (error) throw error;
    }
    await admin.from("country_sources").update({ last_fetched_at: new Date().toISOString(), fetch_status: "ok", fetch_error: null }).eq("id", sourceId);
    await admin.from("onboarding_job_steps").update({ status: "completed", output: { source_id: sourceId, url, chunks: chunks.length, reused: false }, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
    return { status: "completed", stage: "corpus_ingest", source: sourceId, chunks: chunks.length };
  } catch (err) {
    await admin.from("country_sources").update({ last_fetched_at: new Date().toISOString(), fetch_status: "failed", fetch_error: ((err as Error).message ?? String(err)).slice(0, 500) }).eq("id", sourceId);
    throw err;
  }
}

async function executeSecondBrainSeed(admin: any, job: any, step: any) {
  const country = await loadCountry(admin, job.country_code);
  const [sectorsRes, kpisRes, sourcesRes, dossiersRes, ministriesRes] = await Promise.all([
    admin.from("country_sectors").select("sector_code, share_pct").eq("country_code", job.country_code).order("share_pct", { ascending: false }),
    admin.from("country_kpis").select("kpi_code,label,latest_value,latest_period,unit,source_url,source_org").eq("country_code", job.country_code).limit(40),
    admin.from("country_sources").select("url,title,org,kind,quality_score").eq("country_code", job.country_code).eq("active", true).order("quality_score", { ascending: false }).limit(25),
    admin.from("sector_dossiers").select("sector_code,kind,payload,citations").eq("country_code", job.country_code).limit(50),
    admin.from("ministry_profiles").select("ministry_slug,minister,mandate,programmes,citations").eq("country_code", job.country_code).limit(40),
  ]);
  const sectors = sectorsRes.data ?? [];
  const kpis = kpisRes.data ?? [];
  const sources = sourcesRes.data ?? [];
  if (!sectors.length || !kpis.length || !sources.length) throw new Error("Second-brain seed requires sectors, KPIs, and sources");
  const memories: Array<{ sector_code: string; kind: string; title: string; body: string; weight: number }> = [];
  const topSectors = sectors.slice(0, 5);
  memories.push({ sector_code: topSectors[0]?.sector_code ?? "cross_cutting", kind: "position", title: `${country.name} evidence-first fiscal posture`, body: `${country.name} should anchor cabinet decisions in committed macro KPIs, sector composition, and primary-source citations before public release.`, weight: 5 });
  memories.push({ sector_code: topSectors[0]?.sector_code ?? "cross_cutting", kind: "audience", title: `${country.name} cabinet audience`, body: "Primary audience: Prime Minister, Cabinet, Cabinet Secretary, permanent secretaries, line ministers, and technical advisors. Register: concise, measured, evidence-led.", weight: 5 });
  for (const s of sources.slice(0, 6)) memories.push({ sector_code: topSectors[0]?.sector_code ?? "cross_cutting", kind: "outlet", title: `${s.org ?? s.title} source channel`, body: `${s.org ?? s.title} is a monitored source for ${country.name}: ${s.url}`, weight: Math.min(5, Math.max(2, Number(s.quality_score ?? 3))) });
  for (const k of kpis.filter((r: any) => r.latest_value != null).slice(0, 8)) memories.push({ sector_code: topSectors[0]?.sector_code ?? "cross_cutting", kind: "fact", title: `${k.label ?? k.kpi_code} (${k.latest_period ?? "latest"})`, body: `${k.label ?? k.kpi_code}: ${k.latest_value} ${k.unit ?? ""} for ${k.latest_period ?? "latest available period"}. Source: ${k.source_org ?? k.source_url ?? "committed KPI table"}.`, weight: 4 });
  for (const d of [...(dossiersRes.data ?? []), ...(ministriesRes.data ?? [])].slice(0, 6)) memories.push({ sector_code: (d as any).sector_code ?? topSectors[0]?.sector_code ?? "cross_cutting", kind: "risk", title: `${(d as any).sector_code ?? (d as any).ministry_slug ?? "portfolio"} evidence gap`, body: `Review source coverage and policy assumptions before high-stakes decisions involving ${(d as any).sector_code ?? (d as any).ministry_slug ?? "this portfolio"}.`, weight: 3 });
  const existingRes = await admin.from("memory_objects").select("id, sector_code, kind, title, verified").eq("scope_key", job.country_code);
  const existing = existingRes.data ?? [];
  let inserted = 0, updated = 0, skipped = 0;
  for (const m of memories) {
    const key = `${m.sector_code}|${m.kind}|${normalizeMemoryTitle(m.title)}`;
    const found = existing.find((r: any) => `${r.sector_code}|${r.kind}|${normalizeMemoryTitle(r.title ?? "")}` === key);
    if (found?.verified) { skipped++; continue; }
    if (found) {
      const { error } = await admin.from("memory_objects").update({ payload: { body: m.body }, weight: m.weight }).eq("id", found.id);
      if (error) throw error;
      updated++;
    } else {
      const { error } = await admin.from("memory_objects").insert({ scope_key: job.country_code, sector_code: m.sector_code, kind: m.kind, title: m.title, payload: { body: m.body }, weight: m.weight, verified: false, created_by: job.started_by ?? null });
      if (error) throw error;
      inserted++;
    }
  }
  await admin.from("onboarding_job_steps").update({ status: "completed", output: { inserted, updated, skipped, generated: memories.length, method: "deterministic-grounded-memory" }, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
  return { status: "completed", stage: "second_brain_seed", inserted, updated, skipped };
}

async function executeCapitalFlows(admin: any, job: any, step: any) {
  const country = await loadCountry(admin, job.country_code);
  const [sectorsC, kpisC, sourcesC, chunksC, memoryC] = await Promise.all([
    admin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", job.country_code),
    admin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", job.country_code),
    admin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", job.country_code).eq("active", true),
    admin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", job.country_code),
    admin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", job.country_code),
  ]);
  const missing: string[] = [];
  if (!country.gdp_current_usd || Number(country.gdp_current_usd) <= 0) missing.push("GDP");
  if ((sectorsC.count ?? 0) <= 0) missing.push("sector composition");
  if ((kpisC.count ?? 0) <= 0) missing.push("KPI seed");
  if ((sourcesC.count ?? 0) <= 0) missing.push("source registry");
  if ((chunksC.count ?? 0) <= 0) missing.push("corpus chunks");
  if ((memoryC.count ?? 0) <= 0) missing.push("second-brain memory");
  if (missing.length) {
    await admin.from("onboarding_job_steps").update({ status: "blocked", error: `Capital flows preflight blocked — commit first: ${missing.join(", ")}`, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
    return { status: "blocked", stage: "capital_flows", error: `missing ${missing.join(", ")}` };
  }
  const runId = await openLegacyRun(admin, { countryCode: job.country_code, stage: "capital_flows", userId: job.started_by ?? null, modelStack: { durable: "stage", strategy: "evidence-workbook" } });
  const { buildCapitalFlowsDraft } = await import("./capital-flows.server");
  const workbook = await buildCapitalFlowsDraft({ admin, country, runId });
  const payload = workbook.payload as any;
  const orderedCitations = workbook.citations.length
    ? workbook.citations.map((c: any) => ({ url: c.url, domain: c.domain ?? null, title: c.title ?? null }))
    : (payload.flows ?? []).filter((f: any) => isValidHttpUrl(f.source_url)).map((f: any) => citationFromUrl(f.source_url, `${f.source_org ?? "Capital-flow"} source`));
  const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
  const seenSources = new Set<string>();
  for (const f of payload.flows ?? []) {
    if (!isValidHttpUrl(f.source_url) || seenSources.has(f.source_url)) continue;
    seenSources.add(f.source_url);
    await upsertCountrySource(admin, { country_code: job.country_code, url: f.source_url, title: `${f.source_org || "Source"} — capital-flow source`, org: f.source_org || "Auto", kind: "flow_source", tags: ["auto", "capital_flow"], quality_score: f.confidence_grade === "A" ? 5 : f.confidence_grade === "B" ? 4 : 3, active: true, created_by: job.started_by ?? null });
  }
  const { error: clearErr } = await admin.from("country_capital_flows").delete().eq("country_code", job.country_code);
  if (clearErr) throw clearErr;
  let upserted = 0;
  for (const f of payload.flows ?? []) {
    const { error } = await admin.from("country_capital_flows").upsert({
      country_code: job.country_code,
      node_key: f.node_key,
      period: payload.period || f.period || "unknown",
      value_usd_m: Number(f.value_usd_m),
      method: f.method || "reported",
      confidence_grade: f.confidence_grade || "C",
      notes: [f.notes, f.formula ? `Formula: ${f.formula}` : null, f.source_kind ? `Source basis: ${f.source_kind}` : null].filter(Boolean).join("\n") || null,
      citations: orderedCitations,
    }, { onConflict: "country_code,node_key,period" });
    if (error) throw error;
    upserted++;
  }
  await admin.from("onboarding_runs").update({ status: workbook.coverageOk ? "committed" : "needs_review", finished_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: workbook.coverageOk ? null : `Coverage insufficient: ${payload.coverage.inputs.length}/6 inputs, ${payload.coverage.outputs.length}/6 outputs, ${(workbook.reconciliationPct * 100).toFixed(0)}% residual`, plan: { strategy: "durable-evidence-workbook", attempts: workbook.attempts, coverage: payload.coverage, reconciliation: payload.reconciliation } }).eq("id", runId);
  await admin.from("onboarding_job_steps").update({ status: workbook.coverageOk ? "completed" : "needs_review", output: { upserted, runId, coverageOk: workbook.coverageOk, reconciliationPct: workbook.reconciliationPct, count: workbook.count }, error: workbook.coverageOk ? null : "Capital-flow workbook needs review before it is considered complete", finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
  return { status: workbook.coverageOk ? "completed" : "needs_review", stage: "capital_flows", upserted, coverageOk: workbook.coverageOk };
}

async function recordKpiAttempt(admin: any, runId: string, countryCode: string, attempt: import("./kpi-research.server").AttemptRecord) {
  await admin.from("kpi_research_attempts").insert({
    run_id: runId,
    country_code: countryCode,
    kpi_code: attempt.kpi_code,
    pass: attempt.pass,
    provider: attempt.provider,
    model: attempt.model ?? null,
    ok: attempt.ok,
    value: attempt.value,
    period: attempt.period,
    source_url: attempt.source_url,
    error: attempt.error,
  });
}

async function expandKpiSeed(admin: any, job: any, parent: any) {
  const { registryFor } = await import("./kpi-registry");
  const registry = registryFor(["all"]);
  const country = await loadCountry(admin, job.country_code);
  const runId = await openLegacyRun(admin, {
    countryCode: job.country_code,
    stage: "kpi_seed",
    userId: job.started_by ?? null,
    modelStack: { durable: "per-kpi", perplexity: "sonar-pro", lovable_ai: "google/gemini-2.5-pro" },
  });
  const children = registry.map((k, order) => ({
    job_id: job.id,
    country_code: job.country_code,
    stage: "kpi_seed",
    step_key: `kpi:${k.kpi_code}`,
    step_type: "kpi",
    status: "queued",
    checkpoint: { order, runId, kpi_code: k.kpi_code, country },
    output: {},
  }));
  const { error } = await admin.from("onboarding_job_steps").upsert(children, { onConflict: "job_id,stage,step_key" });
  if (error) throw error;
  await admin.from("onboarding_job_steps").update({
    status: "running",
    checkpoint: { ...(parent.checkpoint ?? {}), expanded: true, runId, totalKpis: registry.length },
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: "expanded", stage: "kpi_seed", runId, totalKpis: registry.length };
}

async function executeKpiChild(admin: any, job: any, step: any) {
  const { findRegistryEntry } = await import("./kpi-registry");
  const research = await import("./kpi-research.server");
  const inferMod = await import("./kpi-inference.server");
  const checkpoint = step.checkpoint ?? {};
  const kpiCode = String(checkpoint.kpi_code ?? step.step_key.replace(/^kpi:/, ""));
  const kpi = findRegistryEntry(kpiCode);
  if (!kpi) throw new Error(`Unknown KPI ${kpiCode}`);
  const country = checkpoint.country ?? await loadCountry(admin, job.country_code);
  const runId = String(checkpoint.runId ?? "");
  if (!runId) throw new Error("KPI child missing parent onboarding run id");
  const iso3 = country.iso3 ?? country.code;
  const attempts: import("./kpi-research.server").AttemptRecord[] = [];
  let value: import("./kpi-research.server").ResearchedValue | null = null;
  let inference: import("./kpi-inference.server").InferenceResult | null = null;

  const wb = await research.backfillWorldBank(iso3, kpi);
  attempts.push(wb.attempt);
  await recordKpiAttempt(admin, runId, job.country_code, wb.attempt);
  if (wb.value) value = research.normalizeValue(wb.value);

  if (!value || value.value == null) {
    const imf = await research.backfillImf(iso3, kpi);
    attempts.push(imf.attempt);
    await recordKpiAttempt(admin, runId, job.country_code, imf.attempt);
    if (imf.value) value = research.normalizeValue(imf.value);
  }

  if (!value || value.value == null) {
    const targeted = await research.targetedPerplexity({ country, kpi });
    attempts.push(targeted.attempt);
    await recordKpiAttempt(admin, runId, job.country_code, targeted.attempt);
    if (targeted.value) value = research.normalizeValue(targeted.value);
  }

  if (!value || value.value == null) {
    const gemini = await research.escalateGemini({ country, kpi });
    attempts.push(gemini.attempt);
    await recordKpiAttempt(admin, runId, job.country_code, gemini.attempt);
    if (gemini.value) value = research.normalizeValue(gemini.value);
  }

  if (!value || value.value == null) {
    const inferred = await inferMod.inferOneKpi({ admin, country, kpi });
    inference = inferred.result;
    const attempt = {
      kpi_code: inferred.attempt.kpi_code,
      pass: "escalation" as const,
      provider: "lovable-ai" as const,
      model: inferred.attempt.model,
      ok: inferred.attempt.ok,
      value: inferred.attempt.value,
      period: inferred.attempt.period,
      source_url: inferred.attempt.source_url,
      error: inferred.attempt.error ? `inference: ${inferred.attempt.error}` : null,
    };
    attempts.push(attempt);
    await recordKpiAttempt(admin, runId, job.country_code, attempt);
    if (inferred.result) {
      value = {
        kpi_code: inferred.result.kpi_code,
        value: inferred.result.value,
        period: inferred.result.period,
        source_url: inferred.result.source_url,
        source_org: inferred.result.source_org,
        notes: `Inferred (${inferred.result.confidence}) via ${inferred.result.model}`,
      };
    }
  }

  const output = {
    kpi_code: kpi.kpi_code,
    value: value?.value ?? null,
    period: value?.period ?? null,
    source_url: value?.source_url ?? null,
    source_org: value?.source_org ?? null,
    notes: value?.notes ?? "not found after durable per-KPI research",
    inference,
    attempts: attempts.length,
    ok: value?.value != null,
  };
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output: output as any,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", step.id);
  return { status: "completed", stage: "kpi_seed", kpi: kpi.kpi_code, ok: output.ok };
}

async function finalizeKpiSeed(admin: any, job: any, parent: any) {
  const { data: children } = await admin
    .from("onboarding_job_steps")
    .select("output, status")
    .eq("job_id", job.id)
    .eq("stage", "kpi_seed")
    .eq("step_type", "kpi");
  const rows = children ?? [];
  if (!rows.length || !rows.every((s: any) => TERMINAL.includes(s.status))) return expandKpiSeed(admin, job, parent);
  const runId = String(parent.checkpoint?.runId ?? rows[0]?.output?.runId ?? "");
  if (!runId) throw new Error("KPI parent missing run id for finalization");
  const { finalizeKpiSeedOutputs } = await import("./kpi-seed.server");
  const res = await finalizeKpiSeedOutputs({
    admin,
    runId,
    countryCode: job.country_code,
    userId: job.started_by ?? null,
    outputs: rows.map((r: any) => r.output).filter(Boolean),
    autoCommit: true,
  });
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output: res as any,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: "completed", stage: "kpi_seed", res };
}

async function executeStep(admin: any, job: any, step: any) {
  const now = new Date().toISOString();
  await admin
    .from("onboarding_job_steps")
    .update({ status: "running", attempt_count: Number(step.attempt_count ?? 0) + 1, started_at: step.started_at ?? now, heartbeat_at: now, lease_owner: "durable-worker", lease_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), error: null })
    .eq("id", step.id);
  await admin.from("onboarding_jobs").update({ status: "running", current_stage: step.stage, heartbeat_at: now }).eq("id", job.id);
  await writeEvent(admin, { jobId: job.id, stepId: step.id, countryCode: job.country_code, eventType: "step.started", message: `Started ${step.stage}` });

  try {
    const committed = await countCommitted(admin, job.country_code, step.stage as Stage);
    if (job.mode === "pending" && committed > 0 && step.step_type === "stage" && step.status === "queued" && !CHILD_STEP_TYPES[step.stage as Stage]) {
      await admin.from("onboarding_job_steps").update({ status: "skipped", output: { committedRows: committed }, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
      return { status: "skipped", stage: step.stage };
    }

    if (step.stage === "kpi_seed" && step.step_type === "kpi") {
      return await executeKpiChild(admin, job, step);
    }

    if (step.stage === "ministry_deep_dive" && step.step_type === "ministry") {
      return await executeMinistryChild(admin, job, step);
    }

    if (step.stage === "corpus_ingest" && step.step_type === "source") {
      return await executeCorpusSourceChild(admin, job, step);
    }

    if (step.stage === "kpi_seed") {
      const { count } = await admin
        .from("onboarding_job_steps")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .eq("stage", "kpi_seed")
        .eq("step_type", "kpi");
      if (!count) return await expandKpiSeed(admin, job, step);
      return await finalizeKpiSeed(admin, job, step);
    }

    if (step.stage === "ministry_sector_map") return await executeMinistrySectorMap(admin, job, step);
    if (step.stage === "sector_dossier") return await executeSectorDossier(admin, job, step);
    if (step.stage === "ministry_deep_dive") {
      const { count } = await admin.from("onboarding_job_steps").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("stage", "ministry_deep_dive").eq("step_type", "ministry");
      if (!count) return await expandMinistryDeepDive(admin, job, step);
      return await finalizeChildStage(admin, job, step, "ministry", "ministries");
    }
    if (step.stage === "corpus_ingest") {
      const { count } = await admin.from("onboarding_job_steps").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("stage", "corpus_ingest").eq("step_type", "source");
      if (!count) return await expandCorpusIngest(admin, job, step);
      return await finalizeChildStage(admin, job, step, "source", "sources");
    }
    if (step.stage === "second_brain_seed") return await executeSecondBrainSeed(admin, job, step);
    if (step.stage === "capital_flows") return await executeCapitalFlows(admin, job, step);

    // Early bootstrap stages are still expected to be committed before a
    // pending durable resume reaches this point. If a brand-new country reaches
    // one of them uncommitted, block explicitly instead of doing silent fake data.
    await admin.from("onboarding_job_steps").update({
      status: "blocked",
      error: `${step.stage} is a bootstrap stage and is not yet committed; run this stage individually, then resume the durable job.`,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    }).eq("id", step.id);
    return { status: "blocked", stage: step.stage };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await admin.from("onboarding_job_steps").update({
      status: Number(step.attempt_count ?? 0) + 1 >= Number(step.max_attempts ?? 3) ? "failed" : "queued",
      error: msg.slice(0, 1000),
      heartbeat_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
    }).eq("id", step.id);
    await writeEvent(admin, { jobId: job.id, stepId: step.id, countryCode: job.country_code, eventType: "step.failed", message: msg.slice(0, 500) });
    return { status: "failed", stage: step.stage, error: msg };
  }
}

export async function processOnboardingJobs(admin: any, opts: { countryCode?: string; limit?: number } = {}) {
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await admin.from("onboarding_jobs").update({ status: "stale", error: "worker reconcile: no heartbeat >15min", finished_at: new Date().toISOString() }).in("status", ["queued", "running"]).lt("updated_at", staleCutoff);
  await admin.from("onboarding_job_steps").update({ status: "stale", error: "worker reconcile: no heartbeat >15min", finished_at: new Date().toISOString() }).eq("status", "running").lt("updated_at", staleCutoff);

  let query = admin.from("onboarding_jobs").select("*").in("status", ["queued", "running"]).order("created_at", { ascending: true }).limit(opts.limit ?? 1);
  if (opts.countryCode) query = query.eq("country_code", opts.countryCode);
  const { data: jobs, error } = await query;
  if (error) throw error;

  const processed: unknown[] = [];
  for (const job of jobs ?? []) {
    const step = await nextRunnableStep(admin, job);
    if (!step) {
      await refreshJobStatus(admin, job.id);
      processed.push({ jobId: job.id, status: "idle" });
      continue;
    }
    const res = await executeStep(admin, job, step);
    await refreshJobStatus(admin, job.id);
    processed.push({ jobId: job.id, ...res });
  }
  return { ok: true, processed };
}