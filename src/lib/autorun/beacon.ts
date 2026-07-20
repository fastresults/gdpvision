// Global auto-run beacon store.
//
// Any long-running AI auto-run anywhere in the app publishes its current
// state here so a single top-level <AutoRunBeacon /> can show a clear,
// persistent indicator (floating card + optional modal) regardless of which
// route the user navigates to. When the run finishes, the entry clears.
//
// Includes a client-side health watchdog: entries whose progress hasn't moved
// for a while are marked slow/stalled, and if the publisher registered a
// `resume` callback the watchdog invokes it automatically. After 2 failed
// resume attempts the entry is marked `broken` and the UI surfaces a manual
// Retry action.

import { useSyncExternalStore } from "react";

export type AutoRunHealth =
  | "healthy"
  | "slow"
  | "stalled"
  | "recovering"
  | "broken";

export type AutoRunEntry = {
  id: string;                 // stable per run (e.g. `stage02:GRD`)
  scope: string;              // short label, e.g. "Chamber 07 · Stage 02"
  title: string;              // human title
  detail?: string;            // current step
  progress?: { current: number; total: number };
  href?: string;              // deep-link back to the running surface
  status: "running" | "paused" | "error" | "complete";
  message?: string;           // error/paused reason
  startedAt: number;
  // Health tracking
  lastProgressAt: number;     // updated when detail/progress moves
  health: AutoRunHealth;
  resumeAttempts: number;
  lastResumeAt?: number;
};

type ResumeFn = () => void | Promise<void>;

type State = Map<string, AutoRunEntry>;

let state: State = new Map();
const resumers = new Map<string, ResumeFn>();
const listeners = new Set<() => void>();

const SLOW_MS = 30_000;
const STALLED_MS = 90_000;
const RESUME_COOLDOWN_MS = 60_000;
const MAX_RESUME_ATTEMPTS = 2;

function emit() {
  // clone so React sees a new reference
  state = new Map(state);
  listeners.forEach((l) => l());
}

function progressSignature(e: Pick<AutoRunEntry, "detail" | "progress">) {
  return `${e.detail ?? ""}|${e.progress?.current ?? ""}/${e.progress?.total ?? ""}`;
}

export function publishAutoRun(
  entry: Omit<AutoRunEntry, "startedAt" | "lastProgressAt" | "health" | "resumeAttempts"> & {
    startedAt?: number;
  },
) {
  const prev = state.get(entry.id);
  const now = Date.now();
  const prevSig = prev ? progressSignature(prev) : "";
  const nextSig = progressSignature(entry);
  const moved = !prev || prevSig !== nextSig || entry.status !== prev.status;
  state.set(entry.id, {
    startedAt: prev?.startedAt ?? entry.startedAt ?? now,
    lastProgressAt: moved ? now : prev?.lastProgressAt ?? now,
    health: entry.status === "running" ? (moved ? "healthy" : prev?.health ?? "healthy") : "healthy",
    resumeAttempts: moved ? 0 : prev?.resumeAttempts ?? 0,
    lastResumeAt: prev?.lastResumeAt,
    ...entry,
  });
  emit();
}

export function clearAutoRun(id: string) {
  resumers.delete(id);
  if (!state.has(id)) return;
  state.delete(id);
  emit();
}

export function registerAutoRunResume(id: string, fn: ResumeFn) {
  resumers.set(id, fn);
}

export function unregisterAutoRunResume(id: string) {
  resumers.delete(id);
}

export async function resumeAutoRun(id: string) {
  const entry = state.get(id);
  const fn = resumers.get(id);
  if (!entry || !fn) return;
  state.set(id, {
    ...entry,
    health: "recovering",
    resumeAttempts: entry.resumeAttempts + 1,
    lastResumeAt: Date.now(),
    lastProgressAt: Date.now(), // give the tick some breathing room
  });
  emit();
  try {
    await fn();
  } catch {
    // swallow — the watchdog will re-evaluate health on the next tick
  }
}

// --- Watchdog ---------------------------------------------------------------

let tickHandle: ReturnType<typeof setInterval> | null = null;

function tick() {
  const now = Date.now();
  let changed = false;
  for (const [id, e] of state) {
    if (e.status !== "running") continue;
    const since = now - e.lastProgressAt;
    let nextHealth: AutoRunHealth = e.health;
    if (since < SLOW_MS) {
      nextHealth = "healthy";
    } else if (since < STALLED_MS) {
      nextHealth = e.health === "recovering" ? "recovering" : "slow";
    } else {
      // stalled territory
      const hasResume = resumers.has(id);
      const attempts = e.resumeAttempts;
      const cooled = !e.lastResumeAt || now - e.lastResumeAt > RESUME_COOLDOWN_MS;
      if (hasResume && attempts < MAX_RESUME_ATTEMPTS && cooled) {
        // fire and forget; resumeAutoRun will flip health to recovering
        void resumeAutoRun(id);
        continue;
      }
      if (hasResume && attempts >= MAX_RESUME_ATTEMPTS) {
        nextHealth = "broken";
      } else {
        nextHealth = "stalled";
      }
    }
    if (nextHealth !== e.health) {
      state.set(id, { ...e, health: nextHealth });
      changed = true;
    }
  }
  if (changed) emit();
}

function ensureWatchdog() {
  if (tickHandle || typeof window === "undefined") return;
  tickHandle = setInterval(tick, 1000);
}

function maybeStopWatchdog() {
  if (listeners.size === 0 && tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  ensureWatchdog();
  return () => {
    listeners.delete(l);
    maybeStopWatchdog();
  };
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
