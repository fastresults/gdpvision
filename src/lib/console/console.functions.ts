// @domain console
// @tables cabinet_sessions,countries,ministries,service_request_deliverables,service_requests
// @ui src/routes/_authenticated/console.$code.index.tsx; src/routes/_authenticated/console.$code.request.new.tsx

// Server functions powering the Country Console (front-facing layer for
// ministers / permanent secretaries). No chamber vocabulary is ever returned
// on requester-facing surfaces.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { averageTurnaroundLabel, DEFAULT_TURNAROUND } from "@/lib/concierge/elapsed";
import { LANE_ORDER, LEXICON, type ChamberId } from "@/lib/concierge/minister-lexicon";

const codeSchema = z.object({ country_code: z.string().min(2).max(8) });

export interface ConsoleRequest {
  id: string;
  question: string;
  status: string;
  submitted_at: string;
  expected_by: string | null;
  delivered_at: string | null;
  accepted_at: string | null;
  internal_chamber: string | null;
  minister_label: string;   // plain-language label; never a chamber id
  ministry: string | null;
}

export interface ConsoleLane {
  chamber: ChamberId;
  label: string;             // minister-facing
  oneLiner: string;
  turnaroundLabel: string;   // "usually 1–2 days" or default
  in_flight: ConsoleRequest[];
}

export interface ConsoleStudy {
  country: { code: string; name: string | null };
  attention: {
    ready_for_you: number;
    in_flight: number;
    overdue: number;
    oldest_in_flight_at: string | null;
  };
  lanes: ConsoleLane[];
  requests: ConsoleRequest[];
  waiting: Array<{
    id: string;
    request_id: string;
    title: string;
    delivered_at: string | null;
    read_at: string | null;
    question: string;
  }>;
  delivered_recent: ConsoleRequest[];
  ministries: Array<{ id: string; name: string; slug: string; open_count: number }>;
  cabinet_next: { id: string; title: string | null; scheduled_for: string } | null;
}

function ministryFromRequest(question: string | null, builtOn: unknown): string | null {
  if (Array.isArray(builtOn)) {
    for (const item of builtOn) {
      if (typeof item === "string" && item.toLowerCase().startsWith("ministry:")) {
        return item.slice("ministry:".length).trim();
      }
    }
  }
  return null;
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
        .select(
          "id,question,status,submitted_at,expected_by,delivered_at,accepted_at,internal_chamber,built_on,minister_summary",
        )
        .eq("country_code", cc)
        .eq("requester_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(100),
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

    const raw = reqRes.data ?? [];
    const requests: ConsoleRequest[] = raw.map((r) => {
      const question =
        (r.question as string | null) ?? (r.minister_summary as string | null) ?? "Request";
      const chamber = (r.internal_chamber as string | null) ?? null;
      const label = chamber && LEXICON[chamber as ChamberId]
        ? LEXICON[chamber as ChamberId].ministerLabel
        : "Request";
      return {
        id: r.id as string,
        question,
        status: (r.status as string) ?? "new",
        submitted_at: (r.submitted_at as string) ?? new Date().toISOString(),
        expected_by: (r.expected_by as string | null) ?? null,
        delivered_at: (r.delivered_at as string | null) ?? null,
        accepted_at: (r.accepted_at as string | null) ?? null,
        internal_chamber: chamber,
        minister_label: label,
        ministry: ministryFromRequest(question, r.built_on),
      };
    });

    const requestIds = requests.map((r) => r.id);
    const inFlightAll = requests.filter(
      (r) => !["delivered", "accepted", "closed"].includes(r.status),
    );
    const deliveredAll = requests.filter((r) =>
      ["delivered", "accepted", "closed"].includes(r.status),
    );

    // Attention counters
    const now = Date.now();
    const overdue = inFlightAll.filter(
      (r) => now - Date.parse(r.submitted_at) > 3 * 24 * 60 * 60 * 1000,
    ).length;
    const oldestInFlightAt = inFlightAll.length
      ? inFlightAll.reduce(
          (min, r) => (Date.parse(r.submitted_at) < Date.parse(min) ? r.submitted_at : min),
          inFlightAll[0].submitted_at,
        )
      : null;

    // Build lanes grouped by internal_chamber → minister-facing label
    const lanes: ConsoleLane[] = LANE_ORDER.map((cid) => {
      const entry = LEXICON[cid];
      const inLane = inFlightAll.filter((r) => r.internal_chamber === cid);
      const laneDelivered = deliveredAll
        .filter((r) => r.internal_chamber === cid)
        .slice(0, 10)
        .map((r) => ({ submitted_at: r.submitted_at, delivered_at: r.delivered_at }));
      const avg = averageTurnaroundLabel(laneDelivered) ?? DEFAULT_TURNAROUND[cid];
      return {
        chamber: cid,
        label: entry.ministerLabel,
        oneLiner: entry.oneLiner,
        turnaroundLabel: avg,
        in_flight: inLane,
      };
    });

    const { data: waitingRows } = requestIds.length
      ? await supabase
          .from("service_request_deliverables")
          .select("id,request_id,title,delivered_at,read_at")
          .in("request_id", requestIds)
          .is("read_at", null)
          .order("delivered_at", { ascending: false })
      : { data: [] };

    const reqById = Object.fromEntries(requests.map((r) => [r.id, r]));

    const ministries = (ministriesRes.data ?? []).map((m) => {
      const open = inFlightAll.filter(
        (r) =>
          r.ministry === m.name ||
          r.question.toLowerCase().includes(m.name.toLowerCase()),
      ).length;
      return { id: m.id, name: m.name, slug: m.slug, open_count: open };
    });

    return {
      country: {
        code: cc,
        name: (countryRes.data as { name: string } | null)?.name ?? null,
      },
      attention: {
        ready_for_you: (waitingRows ?? []).length,
        in_flight: inFlightAll.length,
        overdue,
        oldest_in_flight_at: oldestInFlightAt,
      },
      lanes,
      requests,
      waiting: (waitingRows ?? []).map((w) => ({
        id: w.id,
        request_id: w.request_id,
        title: w.title,
        delivered_at: w.delivered_at,
        read_at: w.read_at,
        question: reqById[w.request_id]?.question ?? "",
      })),
      delivered_recent: deliveredAll.slice(0, 12),
      ministries,
      cabinet_next: (() => {
        const row = (cabinetRes.data ?? [])[0];
        if (!row || !row.scheduled_for) return null;
        return { id: row.id, title: row.title ?? null, scheduled_for: row.scheduled_for };
      })(),
    };
  });
