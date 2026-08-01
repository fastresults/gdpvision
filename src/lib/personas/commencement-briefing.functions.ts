// @domain personas
// @tables programme_briefings,persona_projects,programme_plans,programme_phases,programme_milestones,programme_deliverables,research_panels,research_panel_members,research_contacts,field_instruments,studies
// @ui src/components/personas/field/briefing/BriefingPanel.tsx

// Chamber 07 · Commencement Briefing — assemble, read, and mark as shared.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  BriefingReadinessItem,
  BriefingSection,
  CommencementBriefing,
} from "./commencement-briefing.server";

export type { BriefingReadinessItem, BriefingSection, CommencementBriefing };

export interface BriefingRecord {
  id: string;
  version: number;
  status: string;
  assembled_at: string;
  shared_at: string | null;
  document: CommencementBriefing;
}

/** Compose the dossier from the programme's real artefacts and store a version. */
export const assembleCommencementBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BriefingRecord> => {
    const { assembleBriefing } = await import("./commencement-briefing.server");
    const { supabase, userId } = context;

    const doc = await assembleBriefing(supabase, data.projectId);

    const { data: last } = await supabase
      .from("programme_briefings")
      .select("version")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    const version = ((last?.[0]?.version as number | undefined) ?? 0) + 1;
    doc.version = version;

    const { data: row, error } = await supabase
      .from("programme_briefings")
      .insert({
        project_id: data.projectId,
        country_code: doc.countryCode,
        version,
        status: "draft",
        document: doc as unknown as never,
        assembled_by: userId ?? null,
      } as never)
      .select("id,version,status,assembled_at,shared_at,document")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id as string,
      version: row.version as number,
      status: row.status as string,
      assembled_at: row.assembled_at as string,
      shared_at: (row.shared_at as string | null) ?? null,
      document: row.document as unknown as CommencementBriefing,
    };
  });

/** The latest stored briefing for a programme, or null if none has been made. */
export const getCommencementBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BriefingRecord | null> => {
    const { data: rows, error } = await context.supabase
      .from("programme_briefings")
      .select("id,version,status,assembled_at,shared_at,document")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return null;
    return {
      id: row.id as string,
      version: row.version as number,
      status: row.status as string,
      assembled_at: row.assembled_at as string,
      shared_at: (row.shared_at as string | null) ?? null,
      document: row.document as unknown as CommencementBriefing,
    };
  });

/** Record that this version went to the client. */
export const markBriefingShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ briefingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("programme_briefings")
      .update({ status: "shared", shared_at: new Date().toISOString() } as never)
      .eq("id", data.briefingId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
