// @domain personas
// @tables programme_team,programme_milestones,programme_deliverables
// @ui src/components/personas/field/tracker/TrackerModal.tsx
//
// Chamber 07 · Internal project tracker — the agency's own view of who owns
// what, when it is due and what is blocked. Never client-facing.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TrackerData } from "./tracker-shared";

export const getProgrammeTracker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TrackerData> => {
    const { readTracker } = await import("./programme-tracker.server");
    return readTracker(context.supabase as never, data.projectId);
  });

export const upsertTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        projectId: z.string().uuid(),
        countryCode: z.string().min(2).max(3),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().nullish().or(z.literal("")),
        role: z.string().trim().min(2).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      project_id: data.projectId,
      country_code: data.countryCode.toUpperCase(),
      name: data.name,
      email: data.email ? data.email : null,
      role: data.role,
    };
    const q = data.id
      ? context.supabase.from("programme_team").update(row).eq("id", data.id)
      : context.supabase.from("programme_team").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("programme_team").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTrackerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["milestone", "deliverable"]),
        itemId: z.string().uuid(),
        status: z.enum(["planned", "in_progress", "blocked", "done"]).nullish(),
        assigneeId: z.string().uuid().nullable().optional(),
        blockedReason: z.string().max(400).nullable().optional(),
        dueOn: z.string().nullable().optional(),
        note: z.string().max(2000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { writeItem } = await import("./programme-tracker.server");
    await writeItem(context.supabase as never, data);
    return { ok: true };
  });
