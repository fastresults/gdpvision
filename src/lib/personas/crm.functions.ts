// @domain personas
// @tables research_contacts,research_panels,research_panel_members
// @ui src/components/personas/field/ContactsTable.tsx; src/components/personas/field/PanelPicker.tsx

// Chamber 07 · Participant CRM — the people invited to real-world research.
// This is the ONLY place identity lives. Nothing here is written to the
// corpus; field evidence is attributed by pseudonymous participant code.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export function normEmail(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().toLowerCase();
  return t.length > 3 && t.includes("@") ? t : null;
}

export function normPhone(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/[^0-9+]/g, "");
  return t.length >= 7 ? t : null;
}

const ContactShape = z.object({
  full_name: z.string().trim().min(1).max(160),
  email: z.string().trim().max(255).nullish(),
  phone: z.string().trim().max(60).nullish(),
  organisation: z.string().trim().max(200).nullish(),
  role_title: z.string().trim().max(200).nullish(),
  tags: z.array(z.string().trim().max(60)).max(30).optional(),
  source: z.string().trim().max(120).nullish(),
  consent_status: z.enum(["unknown", "granted", "declined"]).optional(),
  notes: z.string().max(4_000).nullish(),
});

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        search: z.string().max(120).nullish(),
        tag: z.string().max(60).nullish(),
        panelId: z.string().uuid().nullish(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let ids: string[] | null = null;
    if (data.panelId) {
      const { data: members } = await supabase
        .from("research_panel_members")
        .select("contact_id")
        .eq("panel_id", data.panelId);
      ids = (members ?? []).map((m) => m.contact_id as string);
      if (ids.length === 0) return [];
    }

    let q = supabase
      .from("research_contacts")
      .select("*")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (ids) q = q.in("id", ids);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,organisation.ilike.%${s}%,role_title.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        countryCode: z.string(),
        contact: ContactShape,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const c = data.contact;
    const payload = {
      country_code: data.countryCode,
      full_name: c.full_name,
      email: c.email ?? null,
      email_norm: normEmail(c.email),
      phone: c.phone ?? null,
      phone_norm: normPhone(c.phone),
      organisation: c.organisation ?? null,
      role_title: c.role_title ?? null,
      tags: c.tags ?? [],
      source: c.source ?? "manual",
      consent_status: c.consent_status ?? "unknown",
      notes: c.notes ?? null,
      visibility: "private",
      owner_country_code: data.countryCode,
      uploaded_by: userId,
      created_by: userId,
    };

    if (data.id) {
      const { error } = await supabase
        .from("research_contacts")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("research_contacts")
      .upsert(payload as never, { onConflict: "country_code,email_norm" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("research_contacts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setContactOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), optedOut: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("research_contacts")
      .update({
        opted_out_at: data.optedOut ? new Date().toISOString() : null,
        consent_status: data.optedOut ? "declined" : "unknown",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Bulk import ────────────────────────────────────────────────────────────

export const importContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        source: z.string().max(120).optional(),
        rows: z.array(ContactShape).min(1).max(2_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let inserted = 0;
    let merged = 0;
    let skipped = 0;

    // Dedupe within the payload first so one upload can't fight itself.
    const seen = new Set<string>();
    const prepared = [];
    for (const c of data.rows) {
      const em = normEmail(c.email);
      const ph = normPhone(c.phone);
      const key = em ?? ph ?? `name:${c.full_name.toLowerCase()}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      prepared.push({
        country_code: data.countryCode,
        full_name: c.full_name,
        email: c.email ?? null,
        email_norm: em,
        phone: c.phone ?? null,
        phone_norm: ph,
        organisation: c.organisation ?? null,
        role_title: c.role_title ?? null,
        tags: c.tags ?? [],
        source: data.source ?? "import",
        consent_status: c.consent_status ?? "unknown",
        notes: c.notes ?? null,
        visibility: "private",
        owner_country_code: data.countryCode,
        uploaded_by: userId,
        created_by: userId,
      });
    }

    for (const p of prepared) {
      if (p.email_norm) {
        const { data: existing } = await supabase
          .from("research_contacts")
          .select("id")
          .eq("country_code", data.countryCode)
          .eq("email_norm", p.email_norm)
          .maybeSingle();
        if (existing?.id) {
          await supabase
            .from("research_contacts")
            .update({
              full_name: p.full_name,
              organisation: p.organisation,
              role_title: p.role_title,
              phone: p.phone,
              phone_norm: p.phone_norm,
            } as never)
            .eq("id", existing.id as string);
          merged += 1;
          continue;
        }
      }
      const { error } = await supabase.from("research_contacts").insert(p as never);
      if (error) skipped += 1;
      else inserted += 1;
    }

    return { inserted, merged, skipped };
  });

// ── Panels ─────────────────────────────────────────────────────────────────

export const listPanels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: panels, error } = await supabase
      .from("research_panels")
      .select("id,name,description,project_id,created_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = panels ?? [];
    if (list.length === 0) return [];
    const { data: members } = await supabase
      .from("research_panel_members")
      .select("panel_id")
      .in(
        "panel_id",
        list.map((p) => p.id as string),
      );
    const counts = new Map<string, number>();
    for (const m of members ?? []) {
      const k = m.panel_id as string;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return list.map((p) => ({ ...p, member_count: counts.get(p.id as string) ?? 0 }));
  });

export const createPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        projectId: z.string().uuid().nullish(),
        name: z.string().trim().min(1).max(160),
        description: z.string().max(2_000).nullish(),
        contactIds: z.array(z.string().uuid()).max(2_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: panel, error } = await supabase
      .from("research_panels")
      .insert({
        country_code: data.countryCode,
        project_id: data.projectId ?? null,
        name: data.name,
        description: data.description ?? null,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.contactIds?.length) {
      await supabase.from("research_panel_members").insert(
        data.contactIds.map((cid) => ({
          panel_id: panel.id as string,
          contact_id: cid,
          country_code: data.countryCode,
        })) as never,
      );
    }
    return panel;
  });

export const setPanelMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        panelId: z.string().uuid(),
        countryCode: z.string(),
        contactIds: z.array(z.string().uuid()).max(2_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("research_panel_members").delete().eq("panel_id", data.panelId);
    if (data.contactIds.length > 0) {
      const { error } = await supabase.from("research_panel_members").insert(
        data.contactIds.map((cid) => ({
          panel_id: data.panelId,
          contact_id: cid,
          country_code: data.countryCode,
        })) as never,
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true as const, count: data.contactIds.length };
  });

export const deletePanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("research_panels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
