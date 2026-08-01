// @domain personas
// @tables programme_briefings, programme_decks
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx; src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · One source of truth for the two client-facing outputs — the
// commencement briefing and the presentation deck. The track row and the
// briefing panel both read and regenerate through this hook, so a version
// composed in one place is immediately correct in the other.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  assembleCommencementBriefing,
  getCommencementBriefing,
  type BriefingRecord,
} from "@/lib/personas/commencement-briefing.functions";
import {
  assembleProgrammeDeck,
  getProgrammeDeck,
  type DeckRecord,
} from "@/lib/personas/programme-deck.functions";

export interface DossierActions {
  briefing: BriefingRecord | null;
  deck: DeckRecord | null;
  loading: boolean;
  /** Composition failure, in the operator's words. Cleared on the next run. */
  error: string | null;
  setError: (e: string | null) => void;
  assembling: boolean;
  composing: boolean;
  /** Assembled before the brief, plan, panels or instruments last changed. */
  briefingStale: boolean;
  /** Stale inputs, or composed against an older briefing version. */
  deckStale: boolean;
  /** Plain-language reason a control is marked stale, or null. */
  briefingStaleReason: string | null;
  deckStaleReason: string | null;
  assembleBriefing: (opts?: { onDone?: (rec: BriefingRecord) => void }) => void;
  composeDeck: (opts?: { onDone?: (rec: DeckRecord) => void }) => void;
}

function dateLabel(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function useDossierActions(
  projectId: string,
  inputsUpdatedAt?: string | null,
): DossierActions {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const assembleFn = useServerFn(assembleCommencementBriefing);
  const deckFn = useServerFn(assembleProgrammeDeck);

  const briefingQ = useQuery({
    queryKey: ["commencement-briefing", projectId],
    queryFn: (): Promise<BriefingRecord | null> => getCommencementBriefing({ data: { projectId } }),
  });

  const deckQ = useQuery({
    queryKey: ["programme-deck", projectId],
    queryFn: (): Promise<DeckRecord | null> => getProgrammeDeck({ data: { projectId } }),
  });

  const assemble = useMutation({
    mutationFn: () => assembleFn({ data: { projectId } }),
    onSuccess: (rec) => {
      setError(null);
      qc.setQueryData(["commencement-briefing", projectId], rec);
      void qc.invalidateQueries({ queryKey: ["commencement-briefing", projectId] });
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Could not assemble the dossier."),
  });

  const compose = useMutation({
    mutationFn: () => deckFn({ data: { projectId } }),
    onSuccess: (rec) => {
      setError(null);
      qc.setQueryData(["programme-deck", projectId], rec);
      void qc.invalidateQueries({ queryKey: ["programme-deck", projectId] });
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Could not compose the deck."),
  });

  const briefing = briefingQ.data ?? null;
  const deck = deckQ.data ?? null;

  const inputsMovedAfter = (assembledAt: string | null | undefined): boolean =>
    !!inputsUpdatedAt &&
    !!assembledAt &&
    new Date(inputsUpdatedAt).getTime() > new Date(assembledAt).getTime();

  const briefingStale = !!briefing && inputsMovedAfter(briefing.assembled_at);
  const deckBehindBriefing =
    !!deck && !!briefing && deck.deck.briefingVersion !== briefing.document.version;
  const deckStale = !!deck && (deckBehindBriefing || inputsMovedAfter(deck.assembled_at));

  return {
    briefing,
    deck,
    loading: briefingQ.isLoading || deckQ.isLoading,
    error,
    setError,
    assembling: assemble.isPending,
    composing: compose.isPending,
    briefingStale,
    deckStale,
    briefingStaleReason: briefingStale
      ? `Assembled ${dateLabel(briefing?.assembled_at)} — the brief, plan, participants or instruments have changed since.`
      : null,
    deckStaleReason: deckStale
      ? deckBehindBriefing
        ? `Composed against briefing v${deck?.deck.briefingVersion} — the dossier is now v${briefing?.document.version}.`
        : `Composed ${dateLabel(deck?.assembled_at)} — the programme has changed since.`
      : null,
    assembleBriefing: (opts) =>
      assemble.mutate(undefined, { onSuccess: (rec) => opts?.onDone?.(rec) }),
    composeDeck: (opts) => compose.mutate(undefined, { onSuccess: (rec) => opts?.onDone?.(rec) }),
  };
}
