// Per-country Ask thread persisted to localStorage. The counsel_answers
// table already keeps a server-side audit log; this store just powers the
// visible conversation on the client.

import { useCallback, useEffect, useState } from "react";
import type { CounselCitation, CounselResearchSource } from "@/lib/counsel.functions";

export interface AskDeepResearch {
  status: "idle" | "running" | "done" | "error" | "skipped";
  sources?: CounselResearchSource[];
  spoken?: string;
  written?: string;
  citations?: CounselCitation[];
  ranAt?: string;
  error?: string;
}

export interface AskExpound {
  status: "idle" | "running" | "done" | "error";
  memo?: string;
  ranAt?: string;
  error?: string;
}

export interface AskTurn {
  id: string;
  question: string;
  spoken: string;
  written: string;
  citations: CounselCitation[];
  createdAt: string;
  error?: string;
  evidenceState?: "sufficient" | "insufficient";
  evidenceReason?: string;
  deepResearch?: AskDeepResearch;
  expound?: AskExpound;
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

  useEffect(() => {
    setTurns(readTurns(countryCode));
  }, [countryCode]);

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

  const update = useCallback((id: string, patch: Partial<AskTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const clear = useCallback(() => setTurns([]), []);

  const remove = useCallback((id: string) => {
    setTurns((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { turns, append, update, clear, remove };
}
