import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export function userDb(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) throw new ToolError("Sign in to GDPVision to use this tool.");
  return supabaseForUser(ctx);
}

export const clean = (s: string) => s.replace(/[%,()]/g, " ").trim().slice(0, 120);
export const codes = (list?: string[]) =>
  (list ?? []).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2,4}$/.test(c));

export function text(summary: string) {
  return [{ type: "text" as const, text: summary }];
}
