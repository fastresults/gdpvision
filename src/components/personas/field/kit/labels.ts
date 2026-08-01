// Chamber 07 · Field desk · human labels.
//
// No database enum ever reaches the screen.

import type { SessionMethod } from "@/lib/personas/fieldwork-plan.server";

const SESSION_SINGULAR: Record<SessionMethod, string> = {
  focus_group: "Focus group",
  depth_interview: "Depth interview",
  expert_panel: "Expert panel",
  workshop: "Workshop",
  other: "Session",
};

/** "depth_interview" → "Depth interview"; anything else title-cased. */
export function methodLabel(raw: string | null | undefined): string {
  if (!raw) return "Fieldwork";
  const key = raw as SessionMethod;
  if (key in SESSION_SINGULAR) return SESSION_SINGULAR[key];
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** The noun for one unit of return in this wave. */
export function unitLabel(kind: "collection" | "sessions", n: number): string {
  if (kind === "collection") return n === 1 ? "return" : "returns";
  return n === 1 ? "session" : "sessions";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
