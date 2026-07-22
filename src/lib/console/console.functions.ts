// Server functions powering the Country Console (front-facing layer for
// ministers / permanent secretaries). No chamber vocabulary is ever returned
// on requester-facing surfaces.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({ country_code: z.string().min(2).max(8) });

export interface ConsoleStudy {
  country: { code: string; name: string | null };
  requests: Array<{
    id: string;
    question: string;
    status: string;
    submitted_at: string;
    expected_by: string | null;
    delivered_at: string | null;
  }>;
  waiting: Array<{
    id: string;
    request_id: string;
    title: string;
    delivered_at: string | null;
    read_at: string | null;
    question: string;
  }>;
  ministries: Array<{ id: string; name: string; slug: string; open_count: number }>;
  cabinet_next: { id: string; title: string | null; scheduled_for: string } | null;
}

export const getConsoleStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data, context }): Promise<ConsoleStudy> => {
    const cc = data.country_code;
    const { supabase, userId } = context;

    const [countryRes, reqRes, ministriesRes, cabinetRes] = await Promise.all([
      supabase.from("countries").select("code,name").eq("code", cc).maybeSingle(),
      supabase
        .from("service_requests")
        .select("id,question,status,submitted_at,expected_by,delivered_at")
        .eq("country_code", cc)
        .eq("requester_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(50),
      supabase
        .from("ministries")
        .select("id,name,slug")
        .eq("country_code", cc)
        .order("sort_order", { ascending: true }),
      supabase
        .from("cabinet_sessions")
        .select("id,title,scheduled_for")
        .eq("country_code", cc)
        .gte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(1),
    ]);

    const requests = reqRes.data ?? [];
    const requestIds = requests.map((r) => r.id);
    const openReqIds = requests
      .filter((r) => !["delivered", "accepted", "closed"].includes(r.status))
      .map((r) => r.id);

    const { data: waitingRows } = requestIds.length
      ? await supabase
          .from("service_request_deliverables")
          .select("id,request_id,title,delivered_at,read_at")
          .in("request_id", requestIds)
          .is("read_at", null)
          .order("delivered_at", { ascending: false })
      : { data: [] };

    const reqById = Object.fromEntries(requests.map((r) => [r.id, r]));

    // Ministry open counts derived from raw_intake mention (lightweight; we
    // don't have a hard FK yet).
    const ministries = (ministriesRes.data ?? []).map((m) => {
      const open = openReqIds.filter((id) => {
        const req = reqById[id];
        return req?.question?.toLowerCase().includes(m.name.toLowerCase());
      }).length;
      return { id: m.id, name: m.name, slug: m.slug, open_count: open };
    });

    return {
      country: {
        code: cc,
        name: (countryRes.data as { name: string } | null)?.name ?? null,
      },
      requests,
      waiting: (waitingRows ?? []).map((w) => ({
        id: w.id,
        request_id: w.request_id,
        title: w.title,
        delivered_at: w.delivered_at,
        read_at: w.read_at,
        question: reqById[w.request_id]?.question ?? "",
      })),
      ministries,
      cabinet_next: (() => {
        const row = (cabinetRes.data ?? [])[0];
        if (!row || !row.scheduled_for) return null;
        return { id: row.id, title: row.title ?? null, scheduled_for: row.scheduled_for };
      })(),
    };
  });
