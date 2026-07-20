// Global auto-run beacon store.
//
// Any long-running AI auto-run anywhere in the app publishes its current
// state here so a single top-level <AutoRunBeacon /> can show a clear,
// persistent indicator (floating card + optional modal) regardless of which
// route the user navigates to. When the run finishes, the entry clears.

import { useSyncExternalStore } from "react";

export type AutoRunEntry = {
  id: string;                 // stable per run (e.g. `stage02:GRD`)
  scope: string;              // short label, e.g. "Chamber 07 · Stage 02"
  title: string;              // human title, e.g. "Casting segments for Grenada"
  detail?: string;            // current step, e.g. "Casting 2/5 — Ministry buyers"
  progress?: { current: number; total: number };
  href?: string;              // deep-link back to the running surface
  status: "running" | "paused" | "error" | "complete";
  message?: string;           // error/paused reason
  startedAt: number;
};

type State = Map<string, AutoRunEntry>;

let state: State = new Map();
const listeners = new Set<() => void>();

function emit() {
  // clone so React sees a new reference
  state = new Map(state);
  listeners.forEach((l) => l());
}

export function publishAutoRun(entry: Omit<AutoRunEntry, "startedAt"> & { startedAt?: number }) {
  const prev = state.get(entry.id);
  state.set(entry.id, {
    startedAt: prev?.startedAt ?? entry.startedAt ?? Date.now(),
    ...entry,
  });
  emit();
}

export function clearAutoRun(id: string) {
  if (!state.has(id)) return;
  state.delete(id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): State {
  return state;
}

function getServerSnapshot(): State {
  return state;
}

export function useAutoRuns(): AutoRunEntry[] {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return Array.from(map.values()).sort((a, b) => a.startedAt - b.startedAt);
}
