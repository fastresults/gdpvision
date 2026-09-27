// Journey trail: records the pages a user visits in this browser tab so the
// platform can offer a reliable Back (to where they actually came from), a
// "Where I've been" menu, and a return to the right page after sign-in.
// Per tab (sessionStorage), capped, survives refresh. Never stores secrets —
// only same-site paths and page titles.

import { useSyncExternalStore } from "react";
import type { AnyRouter } from "@tanstack/react-router";

export type TrailEntry = { idx: number; href: string; pathname: string; title: string; at: number };

const KEY = "gdpv.nav.trail.v2";
const MAX = 50;
const IGNORE = [/^\/auth(\/|$|\?)/, /^\/reset-password/];

let trail: TrailEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) trail = (JSON.parse(raw) as TrailEntry[]).filter((e) => typeof e?.href === "string" && typeof e?.idx === "number");
  } catch {
    trail = [];
  }
}
function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l());
}

export function getTrail(): TrailEntry[] {
  load();
  return trail;
}

/**
 * Record a resolved navigation at the browser's own history position.
 * Entries at or after this position are dropped (they were replaced or are
 * forward entries), so the trail mirrors real history — no guessing.
 */
export function record(href: string, pathname: string, idx: number) {
  load();
  if (IGNORE.some((r) => r.test(pathname))) return;
  const cur = trail.find((e) => e.idx === idx);
  if (cur?.href === href && trail[trail.length - 1] === cur) return;
  const title = cur && cur.pathname === pathname ? cur.title : "";
  trail = [...trail.filter((e) => e.idx < idx), { idx, href, pathname, title, at: Date.now() }].slice(-MAX);
  save();
}

/** Browser history position of a location (TanStack stores it on history state). */
export function historyIndex(state: unknown): number {
  const v = (state as { __TSR_index?: unknown } | null)?.__TSR_index;
  return typeof v === "number" ? v : 0;
}

export function setCurrentTitle(title: string) {
  load();
  const last = trail[trail.length - 1];
  if (!last || !title || last.title === title) return;
  trail = [...trail.slice(0, -1), { ...last, title }];
  save();
}

/** Last page visited before sign-in was required, if any. */
export function lastVisited(): string | null {
  load();
  return trail[trail.length - 1]?.href ?? null;
}

export function useTrail(): TrailEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTrail,
    () => [],
  );
}

/** Nearest real parent page for a path, used when there is no history to go back to. */
export function parentPath(router: AnyRouter, pathname: string): string {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  while (parts.length > 0) {
    parts.pop();
    const p = "/" + parts.join("/");
    if (p === "/") break;
    try {
      const { foundRoute } = router.getMatchedRoutes(p);
      const full = String(foundRoute?.fullPath ?? "").replace(/\/+$/, "");
      const segs = full.split("/").filter(Boolean);
      if (
        foundRoute &&
        foundRoute.id !== "__root__" &&
        !full.endsWith("$") &&
        segs.length === parts.length // exact page, not a loose/partial match
      )
        return p;
    } catch {
      /* keep climbing */
    }
  }
  return "/home";
}

/** Sanitise a same-site return path (never an external URL). */
export function safeReturnPath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  if (IGNORE.some((r) => r.test(v))) return null;
  return v.slice(0, 1000);
}

/** Start tracking once, from the root component. */
export function startTrail(router: AnyRouter): () => void {
  load();
  const unsub = router.subscribe("onResolved", (evt) => {
    const loc = evt.toLocation;
    record(loc.href, loc.pathname, historyIndex(loc.state ?? router.history.location.state));
    setTimeout(() => setCurrentTitle(document.title.replace(/\s+—\s+GDPVision$/, "")), 120);
  });
  const loc = router.state.location;
  record(loc.href, loc.pathname, historyIndex(router.history.location.state));
  setTimeout(() => setCurrentTitle(document.title.replace(/\s+—\s+GDPVision$/, "")), 300);
  return unsub;
}
