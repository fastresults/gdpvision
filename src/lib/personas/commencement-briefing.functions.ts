// @domain personas
// @tables programme_briefings,persona_projects,programme_plans,programme_phases,programme_milestones,programme_deliverables,research_panels,research_panel_members,research_contacts,field_instruments,studies
// @ui src/components/personas/field/briefing/BriefingPanel.tsx

// Chamber 07 · Commencement Briefing — assemble, read, and mark as shared.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  BriefFact,
  BriefingReadinessItem,
  BriefingSection,
  BriefOpener,
  CommencementBriefing,
} from "./commencement-briefing.server";

export type {
  BriefFact,
  BriefingReadinessItem,
  BriefingSection,
  BriefOpener,
  CommencementBriefing,
};


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

/** The public link state for a programme's latest dossier. */
export interface DossierShareState {
  token: string | null;
  enabled: boolean;
  shared_publicly_at: string | null;
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read the link state without touching it. */
export const getDossierShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ briefingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DossierShareState> => {
    const { data: row, error } = await context.supabase
      .from("programme_briefings")
      .select("share_token,share_enabled,shared_publicly_at")
      .eq("id", data.briefingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      token: row?.share_enabled ? ((row.share_token as string | null) ?? null) : null,
      enabled: !!row?.share_enabled,
      shared_publicly_at: (row?.shared_publicly_at as string | null) ?? null,
    };
  });

/**
 * Create, replace or revoke the public link. The dossier is only publishable
 * once every section traces to the governing brief — an unclean document can
 * never be put behind a link.
 */
export const setDossierShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        briefingId: z.string().uuid(),
        action: z.enum(["create", "regenerate", "revoke"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DossierShareState> => {
    const { data: row, error: readErr } = await context.supabase
      .from("programme_briefings")
      .select("id,document,share_token,shared_publicly_at")
      .eq("id", data.briefingId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("That briefing no longer exists.");

    if (data.action === "revoke") {
      const { error } = await context.supabase
        .from("programme_briefings")
        .update({ share_enabled: false } as never)
        .eq("id", data.briefingId);
      if (error) throw new Error(error.message);
      return {
        token: null,
        enabled: false,
        shared_publicly_at: (row.shared_publicly_at as string | null) ?? null,
      };
    }

    const doc = row.document as unknown as CommencementBriefing | null;
    const clean = doc?.preflight?.every((p) => p.ready) ?? false;
    if (!clean) {
      throw new Error(
        "This dossier has not passed its provenance check, so it cannot be published.",
      );
    }

    const token =
      data.action === "regenerate" || !row.share_token ? newToken() : (row.share_token as string);
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("programme_briefings")
      .update({
        share_token: token,
        share_enabled: true,
        shared_publicly_at: (row.shared_publicly_at as string | null) ?? now,
      } as never)
      .eq("id", data.briefingId);
    if (error) throw new Error(error.message);

    return {
      token,
      enabled: true,
      shared_publicly_at: (row.shared_publicly_at as string | null) ?? now,
    };
  });
