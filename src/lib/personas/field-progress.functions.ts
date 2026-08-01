// @domain personas
// @tables persona_projects,programme_plans,studies,research_panels,research_panel_members,research_contacts,field_instruments,field_responses,field_sessions,field_collections
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx

// Chamber 07 · Field progress — one read that tells the rail where the user is,
// what is done, and what single thing is blocking the next stage.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FieldProgress } from "./field-stages";

/**
 * Read the programme's true stage-by-stage state. Ensures the single `studies`
 * row that carries the field work exists once the plan is active — idempotent,
 * so the workspace is never a dead end waiting on a hidden record.
 */
export const getFieldProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FieldProgress> => {
    const { computeFieldProgress } = await import("./field-progress.server");
    return computeFieldProgress(context.supabase, data.projectId, context.userId ?? null);
  });
