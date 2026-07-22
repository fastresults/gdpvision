// Per-country Ask thread persisted to localStorage. The counsel_answers
// table already keeps a server-side audit log; this store just powers the
// visible conversation on the client.

import { useCallback, useEffect, useState } from "react";
import type { CounselCitation } from "@/lib/counsel.functions";

export interface AskTurn {
  id: string;
  question: string;
  spoken: string;
  written: string;
  citations: CounselCitation[];
  createdAt: string;
  error?: string;
}

function storageKey(countryCode: string) {
  return `console.ask.${countryCode}`;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readTurns(countryCode: string): AskTurn[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(countryCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is AskTurn => typeof t?.id === "string");
  } catch {
    return [];
  }
}

export function useCountryAskThread(countryCode: string) {
  const [turns, setTurns] = useState<AskTurn[]>(() => readTurns(countryCode));

  // Re-read when the country changes (e.g. impersonation switch).
  useEffect(() => {
    setTurns(readTurns(countryCode));
  }, [countryCode]);

  // Persist on change.
  useEffect(() => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(storageKey(countryCode), JSON.stringify(turns));
    } catch {
      // Storage full or blocked — silent.
    }
  }, [countryCode, turns]);

  const append = useCallback((turn: AskTurn) => {
    setTurns((prev) => [...prev, turn]);
  }, []);

  const clear = useCallback(() => setTurns([]), []);

  return { turns, append, clear };
}
