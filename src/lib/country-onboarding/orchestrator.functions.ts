import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  commitGdp,
  commitMinistries,
  commitMinistrySectorMap,
  commitProfile,
  commitSectorComposition,
  getOnboardingStatus,
  runGdpAgent,
  runMinistriesAgent,
  runMinistrySectorMapAgent,
  runProfileAgent,
  runSectorCompositionAgent,
} from "./agents.functions";
import {
  commitKpis,
  commitMinistryDeepDive,
  commitSecondBrainSeed,
  commitSectorDossiers,
  commitSourceRegistry,
  runCorpusIngest,
  runKpiSeedAgent,
  runMinistryDeepDiveAgent,
  runSecondBrainSeedAgent,
  runSectorDossierAgent,
  runSourceRegistryAgent,
} from "./corpus.functions";

type Stage =
  | "profile"
  | "gdp"
  | "sector_composition"
  | "ministries"
  | "ministry_sector_map"
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed";

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  mode: z.enum(["pending", "rerun"]).default("pending"),
});

export const runCountryOnboardingPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const countryCode = data.countryCode;
    const mode = data.mode;
    const levels: Stage[][] = [
      ["profile", "gdp", "sector_composition", "ministries", "source_registry", "kpi_seed"],
      ["ministry_sector_map", "sector_dossier", "ministry_deep_dive", "corpus_ingest"],
      ["second_brain_seed"],
    ];

    const runners: Record<Stage, any> = {
      profile: runProfileAgent,
      gdp: runGdpAgent,
      sector_composition: runSectorCompositionAgent,
      ministries: runMinistriesAgent,
      ministry_sector_map: runMinistrySectorMapAgent,
      source_registry: runSourceRegistryAgent,
      kpi_seed: runKpiSeedAgent,
      sector_dossier: runSectorDossierAgent,
      ministry_deep_dive: runMinistryDeepDiveAgent,
      corpus_ingest: runCorpusIngest,
      second_brain_seed: runSecondBrainSeedAgent,
    };
    const committers: Record<Stage, any> = {
      profile: commitProfile,
      gdp: commitGdp,
      sector_composition: commitSectorComposition,
      ministries: commitMinistries,
      ministry_sector_map: commitMinistrySectorMap,
      source_registry: commitSourceRegistry,
      kpi_seed: commitKpis,
      sector_dossier: commitSectorDossiers,
      ministry_deep_dive: commitMinistryDeepDive,
      corpus_ingest: null,
      second_brain_seed: commitSecondBrainSeed,
    };

    const staleCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("onboarding_pipeline_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: "auto-reconciled: stuck >20min" })
      .eq("country_code", countryCode)
      .eq("status", "running")
      .lt("started_at", staleCutoff);

    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from("onboarding_pipeline_runs")
      .insert({
        country_code: countryCode,
        mode,
        status: "running",
        started_by: context.userId,
        plan: { levels, totalStages: levels.flat().length, completed: 0 },
        results: [],
      })
      .select("id")
      .single();
    if (pErr) {
      if ((pErr as any).code === "23505") {
        throw new Error(`A country onboarding workflow is already running for ${countryCode}. Refresh to see progress.`);
      }
      throw pErr;
    }

    const pipelineId = pipeline.id as string;
    const results: Array<{ stage: Stage; status: string; message?: string; meta?: unknown }> = [];

    const updatePipeline = async (patch: Record<string, unknown>) => {
      await supabaseAdmin
        .from("onboarding_pipeline_runs")
        .update({ ...patch, results: results as any })
        .eq("id", pipelineId);
    };

    const hasPayloadItems = (payload: any) => {
      if (Array.isArray(payload)) return payload.length > 0;
      if (!payload || typeof payload !== "object") return false;
      for (const key of ["kpis", "ministries", "rows", "sources", "items", "mappings", "dossiers", "memories"]) {
        if (Array.isArray(payload[key]) && payload[key].length > 0) return true;
      }
      return Object.keys(payload).length > 0;
    };

    const tryCommitLiveDraft = async (stage: Stage): Promise<boolean> => {
      if (stage === "corpus_ingest") return false;
      const status = await getOnboardingStatus({ data: { countryCode } });
      const draft = (status as any).drafts?.find((d: any) => d.stage === stage && !d.superseded);
      if (!draft) return false;
      if (((draft as any).citations?.length ?? 0) === 0) return false;
      if (!hasPayloadItems(draft.payload)) return false;
      await committers[stage]({ data: { draftId: draft.id } });
      return true;
    };

    const runOne = async (stage: Stage) => {
      await updatePipeline({
        current_stage: stage,
        plan: { levels, totalStages: levels.flat().length, completed: results.length, currentStage: stage },
      });

      try {
        const before = await getOnboardingStatus({ data: { countryCode } });
        const committedBefore = ((before as any).committedTargets?.[stage]?.rows ?? 0) > 0;
        if (mode === "pending" && committedBefore) {
          results.push({ stage, status: "skipped", message: "already committed" });
          return;
        }

        if (mode === "pending" && (await tryCommitLiveDraft(stage))) {
          results.push({ stage, status: "committed", message: "committed existing eligible draft" });
          return;
        }

        const runResult = await runners[stage]({ data: { countryCode } });
        const committed = await tryCommitLiveDraft(stage);
        results.push({
          stage,
          status: committed || stage === "corpus_ingest" ? "committed" : "ready",
          message: committed ? "draft generated and committed" : "draft generated for review",
          meta: runResult,
        });
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        if (/already in progress/i.test(message)) {
          results.push({ stage, status: "skipped", message });
          return;
        }
        results.push({ stage, status: "failed", message });
      } finally {
        await updatePipeline({
          plan: { levels, totalStages: levels.flat().length, completed: results.length, currentStage: stage },
        });
      }
    };

    try {
      for (const level of levels) {
        for (const stage of level) {
          await runOne(stage);
        }
      }
      const failures = results.filter((r) => r.status === "failed");
      await updatePipeline({
        status: failures.length ? "failed" : "completed",
        current_stage: null,
        finished_at: new Date().toISOString(),
        error: failures.length ? `${failures.length} stage(s) failed` : null,
        plan: { levels, totalStages: levels.flat().length, completed: results.length },
      });
      return { pipelineId, status: failures.length ? "failed" : "completed", results };
    } catch (err) {
      await updatePipeline({
        status: "failed",
        current_stage: null,
        finished_at: new Date().toISOString(),
        error: (err as Error).message ?? String(err),
      });
      throw err;
    }
  });