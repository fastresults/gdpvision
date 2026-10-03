// @domain personas
// @tables portfolio_persona_sets,portfolio_personas,portfolio_persona_syntheses,ministry_portfolios,portfolio_skills,government_offices,ministries,ministry_profiles,sector_dossier_briefs
// @ui src/routes/_authenticated/admin/countries.$code.personas.portfolios.$setId.tsx
//
// Chamber 07 · Ministers track — drives the run one tick at a time (see
// engine.server.ts), and regenerates a single persona slot. The page calls
// `runPortfolioTick` in a loop while it is open; closing it simply stops the
// loop, and the next visit resumes from the stored phase.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError, type AnyClient } from "@/lib/syndication/db";

import type { TickResult } from "./engine.server";

export type { TickResult };

export const runPortfolioTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ setId: z.string().uuid() }), d))
  .handler(async ({ data, context }): Promise<TickResult> => {
    if (!process.env.LOVABLE_API_KEY)
      throw new Error(
        "Running is unavailable: the AI gateway key (LOVABLE_API_KEY) is not configured on this server.",
      );
    const { tick } = await import("./engine.server");
    return tick(context.supabase as AnyClient, data.setId);
  });

/** Clears a failed run so it can be tried again from the same phase. */
export const resetPortfolioRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ setId: z.string().uuid() }), d))
  .handler(async ({ data, context }) => {
    const { error } = await db(context.supabase as AnyClient)
      .from("portfolio_persona_sets")
      .update({ run_state: "idle", run_error: null, lock_until: null })
      .eq("id", data.setId);
    if (error) throw governanceError(error);
    return { ok: true };
  });

/**
 * Throws away one persona and sends the run back to casting. The count and
 * the synthesis are redone from the new cast when the run finishes again.
 */
export const regeneratePersonaSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ setId: z.string().uuid(), slot: z.number().int().min(1).max(50) }), d),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase as AnyClient);
    const { data: set, error: sErr } = await c
      .from("portfolio_persona_sets")
      .select("id,kind,status,phase")
      .eq("id", data.setId)
      .maybeSingle();
    if (sErr) throw governanceError(sErr);
    const s = set as { kind: string; status: string; phase: string } | null;
    if (!s) throw new Error("That profile was not found.");
    if (s.kind !== "regional") throw new Error("A country overlay has no personas of its own.");
    if (s.status !== "draft" && s.status !== "returned")
      throw new Error("Reopen this profile before changing its cast.");
    const { error } = await c
      .from("portfolio_personas")
      .delete()
      .eq("set_id", data.setId)
      .eq("slot_index", data.slot);
    if (error) throw governanceError(error);
    if (["qa", "aggregate", "synthesise", "done"].includes(s.phase)) {
      const { error: uErr } = await c
        .from("portfolio_persona_sets")
        .update({ phase: "generate", run_state: "idle", run_error: null, lock_until: null })
        .eq("id", data.setId);
      if (uErr) throw governanceError(uErr);
    }
    return { ok: true };
  });

/** Re-runs the synthesis (and, for the Prime Minister, picks up newly approved portfolios). */
export const resynthesise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ setId: z.string().uuid() }), d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase as AnyClient);
    const { data: set } = await c
      .from("portfolio_persona_sets")
      .select("kind,status")
      .eq("id", data.setId)
      .maybeSingle();
    const s = set as { kind: string; status: string } | null;
    if (!s) throw new Error("That profile was not found.");
    if (s.status !== "draft" && s.status !== "returned")
      throw new Error("Reopen this profile before synthesising it again.");
    const { error } = await c
      .from("portfolio_persona_sets")
      .update({
        phase: s.kind === "overlay" ? "overlay" : "aggregate",
        run_state: "idle",
        run_error: null,
        lock_until: null,
      })
      .eq("id", data.setId);
    if (error) throw governanceError(error);
    return { ok: true };
  });
