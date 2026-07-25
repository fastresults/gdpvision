// @domain core
// @tables comms_artifacts,counsel_answers,intake_items,narrative_lineage,strategy_statements
// @ui src/routes/_authenticated/narrative/trace.$id.tsx

// Signal → Strategy → Artifact traceability (PRD Wave B5).
// Writes and reads narrative_lineage rows binding an intake signal to any
// downstream artifact (strategy statement, comms artifact, counsel answer).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LinkInput = z.object({
  signalId: z.string().uuid(),
  artifactType: z.enum(["strategy", "comms", "counsel"]),
  artifactId: z.string().uuid(),
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(64).optional(),
});

export const linkArtifactToSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LinkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("narrative_lineage").insert({
      signal_id: data.signalId,
      artifact_type: data.artifactType,
      artifact_id: data.artifactId,
      scope_key: data.scopeKey,
      sector_code: data.sectorCode ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface TraceLink {
  id: string;
  artifact_type: "strategy" | "comms" | "counsel";
  artifact_id: string;
  title: string;
  status: string;
  created_at: string;
}

export interface Trace {
  signal: {
    id: string;
    scope_key: string;
    sector_code: string;
    topic: string;
    state: string;
    created_at: string;
  };
  links: TraceLink[];
}

export const getTrace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ signalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Trace> => {
    const { data: signal, error } = await context.supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,state,created_at")
      .eq("id", data.signalId)
      .single();
    if (error) throw new Error(error.message);

    const { data: rows } = await context.supabase
      .from("narrative_lineage")
      .select("id,artifact_type,artifact_id,created_at")
      .eq("signal_id", data.signalId)
      .order("created_at", { ascending: true });

    const links: TraceLink[] = [];
    for (const r of rows ?? []) {
      let title = "(unknown)";
      let status = "";
      if (r.artifact_type === "strategy") {
        const { data: s } = await context.supabase
          .from("strategy_statements")
          .select("title,status")
          .eq("id", r.artifact_id)
          .maybeSingle();
        if (s) { title = s.title; status = s.status as string; }
      } else if (r.artifact_type === "comms") {
        const { data: c } = await context.supabase
          .from("comms_artifacts")
          .select("kind,audience,draft_state")
          .eq("id", r.artifact_id)
          .maybeSingle();
        if (c) { title = `${c.kind} · ${c.audience}`; status = c.draft_state as string; }
      } else if (r.artifact_type === "counsel") {
        const { data: a } = await context.supabase
          .from("counsel_answers")
          .select("question")
          .eq("id", r.artifact_id)
          .maybeSingle();
        if (a) { title = a.question; status = "answered"; }
      }
      links.push({
        id: r.id,
        artifact_type: r.artifact_type as TraceLink["artifact_type"],
        artifact_id: r.artifact_id,
        title,
        status,
        created_at: r.created_at,
      });
    }

    return { signal, links };
  });
