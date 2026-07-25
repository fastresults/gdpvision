// @domain ledger-qa
// @tables figure_snapshots,intake_items,ledger_qa_actions
// @ui src/routes/_authenticated/admin/ledger-qa.tsx

// Ledger-QA write-probe hygiene.
// snapshot-rt and handoff probes insert a row each run. This admin-gated
// helper trims each probe's rows to the latest N so the tables don't grow
// unbounded during Run-Everything sessions.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  countryCode: z.string().length(3),
  keep: z.number().int().min(1).max(20).default(3),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — super admin only");
}

/**
 * Tombstone stale QA probe rows in figure_snapshots and intake_items.
 * Match pattern: label LIKE 'QA snapshot probe · %' (figure_snapshots)
 * and note = 'Ledger-QA handoff probe' (intake_items).
 * Keeps the latest N per (country, table); deletes the rest.
 * Returns per-table deletion counts.
 */
export const tombstoneQaProbes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cc = data.countryCode;

    // figure_snapshots — QA probe rows
    const { data: snaps } = await supabaseAdmin
      .from("figure_snapshots")
      .select("id, created_at")
      .eq("country_code", cc)
      .like("label", "QA snapshot probe · %")
      .order("created_at", { ascending: false });
    const snapKeep = (snaps ?? []).slice(0, data.keep).map((r) => r.id);
    const snapDrop = (snaps ?? []).filter((r) => !snapKeep.includes(r.id)).map((r) => r.id);
    let snapDeleted = 0;
    if (snapDrop.length > 0) {
      const { error } = await supabaseAdmin.from("figure_snapshots").delete().in("id", snapDrop);
      if (!error) snapDeleted = snapDrop.length;
    }

    // intake_items — QA handoff probe rows (scope_key is lowercased CC; note is embedded in summary)
    const { data: items } = await supabaseAdmin
      .from("intake_items")
      .select("id, created_at")
      .eq("scope_key", cc.toLowerCase())
      .like("summary", "%Ledger-QA handoff probe%")
      .order("created_at", { ascending: false });
    const itemKeep = (items ?? []).slice(0, data.keep).map((r) => r.id);
    const itemDrop = (items ?? []).filter((r) => !itemKeep.includes(r.id)).map((r) => r.id);
    let itemDeleted = 0;
    if (itemDrop.length > 0) {
      const { error } = await supabaseAdmin.from("intake_items").delete().in("id", itemDrop);
      if (!error) itemDeleted = itemDrop.length;
    }

    await supabaseAdmin.from("ledger_qa_actions").insert({
      country_code: cc,
      check_key: "probe-tombstone",
      finding_class: "data-quality",
      action: "tombstoneQaProbes",
      rows_before: (snaps?.length ?? 0) + (items?.length ?? 0),
      rows_after: snapKeep.length + itemKeep.length,
      detail: { snapshots: { kept: snapKeep.length, deleted: snapDeleted },
                intake: { kept: itemKeep.length, deleted: itemDeleted } },
      actor: context.userId,
    });

    return {
      summary: `Trimmed snapshots -${snapDeleted}, intake -${itemDeleted}`,
      snapshots: { kept: snapKeep.length, deleted: snapDeleted },
      intake: { kept: itemKeep.length, deleted: itemDeleted },
    };
  });
