// Context Dossier (PRD §12 Screen 10). Given a signal (intake_item), pull the
// researched surround: related Second-Brain memory objects on the same sector,
// prior strategy statements, and prior comms artifacts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ intakeId: z.string().uuid() });

export interface Dossier {
  signal: {
    id: string;
    scope_key: string;
    sector_code: string;
    topic: string;
    summary: string | null;
    url: string | null;
    proposed_weight: number;
    final_weight: number | null;
    state: string;
    created_at: string;
  };
  memory: Array<{ id: string; kind: string; title: string; weight: number | null; created_at: string }>;
  strategies: Array<{ id: string; title: string; status: string; created_at: string }>;
  comms: Array<{ id: string; kind: string; audience: string; state: string; created_at: string }>;
}

export const getDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<Dossier> => {
    const { supabase } = context;
    const { data: signal, error: sErr } = await supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,summary,url,proposed_weight,final_weight,state,created_at")
      .eq("id", data.intakeId)
      .single();
    if (sErr) throw new Error(sErr.message);

    const [{ data: memory }, { data: strategies }, { data: comms }] = await Promise.all([
      supabase
        .from("memory_objects")
        .select("id,kind,title,weight,created_at")
        .eq("scope_key", signal.scope_key)
        .eq("sector_code", signal.sector_code)
        .order("weight", { ascending: false, nullsFirst: false })
        .limit(20),
      supabase
        .from("strategy_statements")
        .select("id,title,status,created_at,sector_code,country_code")
        .eq("country_code", signal.scope_key)
        .eq("sector_code", signal.sector_code)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("comms_artifacts")
        .select("id,kind,audience,state,created_at,country_code")
        .eq("country_code", signal.scope_key)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      signal,
      memory: (memory ?? []).map((m) => ({
        id: m.id,
        kind: m.kind as string,
        title: m.title,
        weight: m.weight,
        created_at: m.created_at,
      })),
      strategies: (strategies ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status as string,
        created_at: s.created_at,
      })),
      comms: (comms ?? []).map((c) => ({
        id: c.id,
        kind: c.kind as string,
        audience: c.audience,
        state: c.state as string,
        created_at: c.created_at,
      })),
    };
  });
