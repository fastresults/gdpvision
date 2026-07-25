// @domain mandate-compact
// @tables compact_revisions,mandate_compacts
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Slice E — Revisions timeline + structural diff between snapshots.
// Every transition (draft→signed→in_force→concluded) writes a full snapshot to
// compact_revisions. This module reads the timeline and computes human-readable
// diffs so admins can audit exactly what changed between any two revisions.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CompactIdInput = z.object({ compactId: z.string().uuid() });
const RevisionIdInput = z.object({ revisionId: z.string().uuid() });
const CompareInput = z.object({
  compactId: z.string().uuid(),
  fromRevisionId: z.string().uuid(),
  toRevisionId: z.string().uuid(),
});

export type RevisionRow = {
  id: string;
  compact_id: string;
  revision_number: number;
  reason: string | null;
  editor_id: string | null;
  visibility: string;
  created_at: string;
  transition: { from: string; to: string } | null;
  status_at_revision: string | null;
};

export type RevisionSnapshot = {
  id: string;
  revision_number: number;
  reason: string | null;
  created_at: string;
  snapshot: {
    transition?: { from: string; to: string };
    compact?: Record<string, unknown>;
    pillars?: Array<Record<string, unknown>>;
  };
};

export const listCompactRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompactIdInput.parse(raw))
  .handler(async ({ data, context }): Promise<RevisionRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("compact_revisions")
      .select("id, compact_id, revision_number, reason, editor_id, visibility, created_at, snapshot")
      .eq("compact_id", data.compactId)
      .order("revision_number", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      compact_id: r.compact_id,
      revision_number: r.revision_number,
      reason: r.reason,
      editor_id: r.editor_id,
      visibility: r.visibility,
      created_at: r.created_at,
      transition: r.snapshot?.transition ?? null,
      status_at_revision: r.snapshot?.compact?.status ?? null,
    }));
  });

export const getCompactRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => RevisionIdInput.parse(raw))
  .handler(async ({ data, context }): Promise<RevisionSnapshot | null> => {
    const { data: r, error } = await context.supabase
      .from("compact_revisions")
      .select("id, revision_number, reason, created_at, snapshot")
      .eq("id", data.revisionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    return {
      id: r.id,
      revision_number: r.revision_number,
      reason: r.reason,
      created_at: r.created_at,
      snapshot: (r.snapshot ?? {}) as RevisionSnapshot["snapshot"],
    };
  });

// ── Diff engine ─────────────────────────────────────────────────────────

export type FieldChange = { field: string; from: unknown; to: unknown };
export type EntityDiff = {
  id: string;
  label: string;
  kind: "pillar" | "pledge" | "deliverable" | "compact";
  op: "added" | "removed" | "changed";
  changes: FieldChange[];
};

export type CompactDiff = {
  from: { id: string; revision_number: number; status: string | null; created_at: string };
  to: { id: string; revision_number: number; status: string | null; created_at: string };
  summary: {
    pillars_added: number;
    pillars_removed: number;
    pledges_added: number;
    pledges_removed: number;
    deliverables_added: number;
    deliverables_removed: number;
    entities_changed: number;
  };
  entities: EntityDiff[];
};

const COMPACT_FIELDS = ["title", "pm_name", "status", "summary", "visibility", "election_cycle"];
const PILLAR_FIELDS = ["title", "narrative", "color_token", "sort_order"];
const PLEDGE_FIELDS = ["title", "verbatim_quote", "pledge_type", "baseline_value", "target_value", "unit", "sort_order"];
const DELIV_FIELDS = ["title", "theory_of_change", "risk_level", "transformational_note", "lead_ministry_id"];

function scalarEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function diffFields(a: Record<string, any>, b: Record<string, any>, fields: string[]): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of fields) {
    if (!scalarEq(a?.[f], b?.[f])) out.push({ field: f, from: a?.[f] ?? null, to: b?.[f] ?? null });
  }
  return out;
}

function indexEntities(snapshot: RevisionSnapshot["snapshot"]) {
  const pillars = new Map<string, any>();
  const pledges = new Map<string, any>();
  const deliverables = new Map<string, any>();
  for (const p of snapshot.pillars ?? []) {
    pillars.set(String((p as any).id), p);
    for (const pl of ((p as any).pledges ?? []) as any[]) {
      pledges.set(String(pl.id), pl);
      for (const d of (pl.deliverables ?? []) as any[]) deliverables.set(String(d.id), d);
    }
  }
  return { pillars, pledges, deliverables };
}

function walkKind<T extends { id: string }>(
  a: Map<string, any>,
  b: Map<string, any>,
  kind: EntityDiff["kind"],
  labelKey: string,
  fields: string[],
  out: EntityDiff[],
  counters: { added: number; removed: number; changed: number },
) {
  for (const [id, node] of a) {
    if (!b.has(id)) {
      counters.removed += 1;
      out.push({ id, label: node?.[labelKey] ?? id, kind, op: "removed", changes: [] });
    }
  }
  for (const [id, node] of b) {
    if (!a.has(id)) {
      counters.added += 1;
      out.push({ id, label: node?.[labelKey] ?? id, kind, op: "added", changes: [] });
    } else {
      const changes = diffFields(a.get(id) ?? {}, node, fields);
      if (changes.length) {
        counters.changed += 1;
        out.push({ id, label: node?.[labelKey] ?? id, kind, op: "changed", changes });
      }
    }
  }
}

export const compareCompactRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompareInput.parse(raw))
  .handler(async ({ data, context }): Promise<CompactDiff> => {
    const { data: rows, error } = await context.supabase
      .from("compact_revisions")
      .select("id, revision_number, snapshot, created_at, compact_id")
      .in("id", [data.fromRevisionId, data.toRevisionId]);
    if (error) throw new Error(error.message);
    if (!rows || rows.length !== 2) throw new Error("Both revisions must exist");
    for (const r of rows) if (r.compact_id !== data.compactId) throw new Error("Revision does not belong to compact");

    const from = rows.find((r) => r.id === data.fromRevisionId)!;
    const to = rows.find((r) => r.id === data.toRevisionId)!;
    const fromIdx = indexEntities((from.snapshot ?? {}) as any);
    const toIdx = indexEntities((to.snapshot ?? {}) as any);

    const entities: EntityDiff[] = [];
    const counters = {
      pillars: { added: 0, removed: 0, changed: 0 },
      pledges: { added: 0, removed: 0, changed: 0 },
      deliverables: { added: 0, removed: 0, changed: 0 },
    };

    // Compact-level fields
    const compactChanges = diffFields(
      (from.snapshot as any)?.compact ?? {},
      (to.snapshot as any)?.compact ?? {},
      COMPACT_FIELDS,
    );
    if (compactChanges.length) {
      entities.push({
        id: data.compactId,
        label: (to.snapshot as any)?.compact?.title ?? "Compact",
        kind: "compact",
        op: "changed",
        changes: compactChanges,
      });
    }

    walkKind(fromIdx.pillars, toIdx.pillars, "pillar", "title", PILLAR_FIELDS, entities, counters.pillars);
    walkKind(fromIdx.pledges, toIdx.pledges, "pledge", "title", PLEDGE_FIELDS, entities, counters.pledges);
    walkKind(fromIdx.deliverables, toIdx.deliverables, "deliverable", "title", DELIV_FIELDS, entities, counters.deliverables);

    const entities_changed =
      counters.pillars.changed + counters.pledges.changed + counters.deliverables.changed + (compactChanges.length ? 1 : 0);

    return {
      from: {
        id: from.id,
        revision_number: from.revision_number,
        status: (from.snapshot as any)?.compact?.status ?? null,
        created_at: from.created_at,
      },
      to: {
        id: to.id,
        revision_number: to.revision_number,
        status: (to.snapshot as any)?.compact?.status ?? null,
        created_at: to.created_at,
      },
      summary: {
        pillars_added: counters.pillars.added,
        pillars_removed: counters.pillars.removed,
        pledges_added: counters.pledges.added,
        pledges_removed: counters.pledges.removed,
        deliverables_added: counters.deliverables.added,
        deliverables_removed: counters.deliverables.removed,
        entities_changed,
      },
      entities,
    };
  });
