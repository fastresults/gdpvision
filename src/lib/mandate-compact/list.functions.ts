// @domain mandate-compact
// @tables mandate_compacts,compact_pillars,compact_pledges,compact_deliverables
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListInput = z.object({ countryCode: z.string().min(2).max(3) });

export type CompactRow = {
  id: string;
  country_code: string;
  election_cycle: string;
  title: string | null;
  pm_name: string | null;
  status: string;
  summary: string | null;
  visibility: string;
  signed_at: string | null;
  term_start: string | null;
  term_end: string | null;
  manifesto_id: string | null;
  governing_party_id: string | null;
  pillar_count: number;
  pledge_count: number;
  deliverable_count: number;
  updated_at: string;
};

export const listMandateCompacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }): Promise<CompactRow[]> => {
    const { supabase } = context;
    const { data: compacts, error } = await supabase
      .from("mandate_compacts")
      .select("id, country_code, election_cycle, title, pm_name, status, summary, visibility, signed_at, term_start, term_end, manifesto_id, governing_party_id, updated_at")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!compacts?.length) return [];

    const ids = compacts.map((c) => c.id);
    const [pillars, pledges, deliverables] = await Promise.all([
      supabase.from("compact_pillars").select("compact_id").in("compact_id", ids),
      supabase.from("compact_pledges").select("compact_id").in("compact_id", ids),
      supabase.from("compact_deliverables").select("compact_id").in("compact_id", ids),
    ]);
    const bump = (rows: { compact_id: string }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) m.set(r.compact_id, (m.get(r.compact_id) ?? 0) + 1);
      return m;
    };
    const pMap = bump(pillars.data);
    const plMap = bump(pledges.data);
    const dMap = bump(deliverables.data);

    return compacts.map((c) => ({
      ...c,
      pillar_count: pMap.get(c.id) ?? 0,
      pledge_count: plMap.get(c.id) ?? 0,
      deliverable_count: dMap.get(c.id) ?? 0,
    })) as CompactRow[];
  });
