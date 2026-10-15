import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };

function env(names: string[]): string | undefined {
  const e = (globalThis as RuntimeGlobals).process?.env ?? {};
  for (const n of names) {
    const v = e[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function publishableKey(): string {
  const direct = env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const set = env(["SUPABASE_PUBLISHABLE_KEYS"]);
  if (set) {
    try {
      const keys = JSON.parse(set) as Record<string, unknown>;
      const k = [keys.default, ...Object.values(keys)].find(
        (v): v is string => typeof v === "string" && v.startsWith("sb_publishable_"),
      );
      if (k) return k;
    } catch {
      /* fall through */
    }
  }
  const legacy = env(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("Supabase publishable key is not configured");
}

/** Supabase client acting as the verified OAuth caller (RLS applies). */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("A verified sign-in is required");
  const url = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return createClient(url, publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
