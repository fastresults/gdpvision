// @domain personas
// @tables programme_decks,programme_briefings
// @ui src/components/personas/field/deck/DeckModal.tsx
//
// Chamber 07 · Commencement deck — prepare and read the client presentation.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DeckSlide, DeckSlideKind, DeckStat, ProgrammeDeck } from "./programme-deck.server";

export type { DeckSlide, DeckSlideKind, DeckStat, ProgrammeDeck };

export interface DeckRecord {
  id: string;
  version: number;
  status: string;
  assembled_at: string;
  deck: ProgrammeDeck;
}

/** Build a deck from the latest commencement briefing and store a version. */
export const assembleProgrammeDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DeckRecord> => {
    const { supabase, userId } = context;

    const { data: briefRows, error: briefErr } = await supabase
      .from("programme_briefings")
      .select("id,version,document")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    if (briefErr) throw new Error(briefErr.message);
    const briefRow = briefRows?.[0];
    if (!briefRow) throw new Error("Assemble the commencement briefing before preparing a deck.");

    const { assembleDeck } = await import("./programme-deck.server");
    const briefing = briefRow.document as unknown as Parameters<typeof assembleDeck>[0];
    if (!briefing || !Array.isArray(briefing.sections) || briefing.sections.length === 0) {
      throw new Error("The stored briefing is empty — re-assemble it, then prepare the deck.");
    }
    if (!briefing.preflight?.every((item) => item.ready)) {
      throw new Error(
        "This briefing predates provenance validation or failed preflight. Rebuild it from the governing brief first.",
      );
    }

    const deck = await assembleDeck(briefing);

    const { data: last } = await supabase
      .from("programme_decks")
      .select("version")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    const version = ((last?.[0]?.version as number | undefined) ?? 0) + 1;
    deck.version = version;

    const { data: row, error } = await supabase
      .from("programme_decks")
      .insert({
        project_id: data.projectId,
        briefing_id: briefRow.id as string,
        country_code: deck.countryCode,
        version,
        status: "draft",
        deck: deck as unknown as never,
        assembled_by: userId ?? null,
      } as never)
      .select("id,version,status,assembled_at,deck")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id as string,
      version: row.version as number,
      status: row.status as string,
      assembled_at: row.assembled_at as string,
      deck: row.deck as unknown as ProgrammeDeck,
    };
  });

/** The latest stored deck for a programme, or null if none has been prepared. */
export const getProgrammeDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DeckRecord | null> => {
    const { data: rows, error } = await context.supabase
      .from("programme_decks")
      .select("id,version,status,assembled_at,deck")
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
      deck: row.deck as unknown as ProgrammeDeck,
    };
  });

/** The public link state for a programme's latest presentation. */
export interface DeckShareState {
  token: string | null;
  enabled: boolean;
  shared_publicly_at: string | null;
}

function newDeckToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read the presentation's link state without touching it. */
export const getDeckShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DeckShareState> => {
    const { data: rows, error } = await context.supabase
      .from("programme_decks")
      .select("share_token,share_enabled,shared_publicly_at")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    return {
      token: row?.share_enabled ? ((row.share_token as string | null) ?? null) : null,
      enabled: !!row?.share_enabled,
      shared_publicly_at: (row?.shared_publicly_at as string | null) ?? null,
    };
  });

/**
 * Create, replace or revoke the presentation's public link. A deck is only
 * publishable once it passes its provenance check — an unclean presentation
 * can never be put behind a link.
 */
export const setDeckShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        action: z.enum(["create", "regenerate", "revoke"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DeckShareState> => {
    const { data: rows, error: readErr } = await context.supabase
      .from("programme_decks")
      .select("id,deck,share_token,shared_publicly_at")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    if (readErr) throw new Error(readErr.message);
    const row = rows?.[0];
    if (!row) throw new Error("Prepare the presentation before publishing a client link.");

    if (data.action === "revoke") {
      const { error } = await context.supabase
        .from("programme_decks")
        .update({ share_enabled: false } as never)
        .eq("id", row.id as string);
      if (error) throw new Error(error.message);
      return {
        token: null,
        enabled: false,
        shared_publicly_at: (row.shared_publicly_at as string | null) ?? null,
      };
    }

    const deck = row.deck as unknown as { preflight?: { ready: boolean }[] } | null;
    const clean = (deck?.preflight ?? []).length > 0 && deck!.preflight!.every((p) => p.ready);
    if (!clean) {
      throw new Error(
        "This presentation has not passed its provenance check, so it cannot be published.",
      );
    }

    const token =
      data.action === "regenerate" || !row.share_token
        ? newDeckToken()
        : (row.share_token as string);
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("programme_decks")
      .update({
        share_token: token,
        share_enabled: true,
        shared_publicly_at: (row.shared_publicly_at as string | null) ?? now,
      } as never)
      .eq("id", row.id as string);
    if (error) throw new Error(error.message);

    return {
      token,
      enabled: true,
      shared_publicly_at: (row.shared_publicly_at as string | null) ?? now,
    };
  });
