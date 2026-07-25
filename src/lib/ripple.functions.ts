// @domain core
// @tables sector_edges
// @ui —

// Ripple propagation (PRD Wave E3).
// Given a scenario impact on a source sector, walk the sector_edges adjacency
// matrix to produce first- and second-order impact decomposition. Fixed
// coefficients in v1; reviewed annually.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SimulateInput = z.object({
  sourceSector: z.string().min(2).max(64),
  amount: z.number(),
  maxOrder: z.number().int().min(1).max(3).default(2),
});

export interface RippleImpact {
  sector: string;
  order: 1 | 2 | 3;
  amount: number;
  path: string[];
}

export const simulateRipple = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SimulateInput.parse(d))
  .handler(async ({ data, context }): Promise<{ direct: RippleImpact; ripples: RippleImpact[] }> => {
    const { data: edges, error } = await context.supabase
      .from("sector_edges")
      .select("from_sector,to_sector,weight,order_rank");
    if (error) throw new Error(error.message);

    const direct: RippleImpact = {
      sector: data.sourceSector,
      order: 1,
      amount: data.amount,
      path: [data.sourceSector],
    };
    const ripples: RippleImpact[] = [];

    const firstOrder = (edges ?? []).filter((e) => e.from_sector === data.sourceSector);
    for (const e of firstOrder) {
      const amt = data.amount * Number(e.weight);
      ripples.push({ sector: e.to_sector, order: 2, amount: Number(amt.toFixed(4)), path: [data.sourceSector, e.to_sector] });
      if (data.maxOrder >= 3) {
        const secondOrder = (edges ?? []).filter((s) => s.from_sector === e.to_sector);
        for (const s of secondOrder) {
          if (s.to_sector === data.sourceSector) continue;
          const amt2 = amt * Number(s.weight);
          ripples.push({
            sector: s.to_sector,
            order: 3,
            amount: Number(amt2.toFixed(4)),
            path: [data.sourceSector, e.to_sector, s.to_sector],
          });
        }
      }
    }

    return { direct, ripples };
  });

export interface SectorEdgeRow {
  id: string;
  from_sector: string;
  to_sector: string;
  weight: number;
  order_rank: number;
  notes: string | null;
}

export const listSectorEdges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SectorEdgeRow[]> => {
    const { data, error } = await context.supabase
      .from("sector_edges")
      .select("id,from_sector,to_sector,weight,order_rank,notes")
      .order("from_sector");
    if (error) throw new Error(error.message);
    return (data ?? []) as SectorEdgeRow[];
  });

const UpsertInput = z.object({
  from: z.string().min(2).max(64),
  to: z.string().min(2).max(64),
  weight: z.number().min(0).max(1),
  order_rank: z.number().int().min(1).max(3).default(2),
  notes: z.string().max(500).optional(),
});

export const upsertSectorEdge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sector_edges")
      .upsert(
        {
          from_sector: data.from,
          to_sector: data.to,
          weight: data.weight,
          order_rank: data.order_rank,
          notes: data.notes ?? null,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "from_sector,to_sector" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
