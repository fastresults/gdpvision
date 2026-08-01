// @domain personas
// @ui src/components/personas/field/tracker/TrackerModal.tsx
//
// Chamber 07 · Client-safe vocabulary for the internal project tracker: the
// roles a survey-and-focus-group engagement actually staffs, and the four
// states a piece of work can be in.

export const TEAM_ROLES = [
  "Engagement lead",
  "Research director",
  "Project manager",
  "Field manager",
  "Moderator",
  "Recruiter",
  "Analyst",
  "Data / scripting",
  "Translator",
  "Client contact",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export const ITEM_STATUSES = ["planned", "in_progress", "blocked", "done"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const STATUS_LABEL: Record<ItemStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

/** Clicking a status cycles it forward; blocked returns to in progress. */
export function nextStatus(s: string): ItemStatus {
  const order: ItemStatus[] = ["planned", "in_progress", "blocked", "done"];
  const i = order.indexOf(s as ItemStatus);
  return order[(i < 0 ? 0 : i + 1) % order.length] as ItemStatus;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface TrackerNote {
  at: string;
  body: string;
}

export interface TrackerItem {
  id: string;
  kind: "milestone" | "deliverable";
  title: string;
  detail: string | null;
  phase: string | null;
  dueOn: string | null;
  status: string;
  assigneeId: string | null;
  blockedReason: string | null;
  notes: TrackerNote[];
}

export interface TrackerData {
  planId: string | null;
  team: TeamMember[];
  items: TrackerItem[];
  /** Live fieldwork counts, so the board reflects what the field is doing. */
  field: { collections: number; open: number; responses: number; sessions: number; held: number };
}

export function isOverdue(item: TrackerItem): boolean {
  if (!item.dueOn || item.status === "done") return false;
  return new Date(item.dueOn).getTime() < new Date().setHours(0, 0, 0, 0);
}

export function dueLabel(d: string | null): string {
  if (!d) return "No date";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
