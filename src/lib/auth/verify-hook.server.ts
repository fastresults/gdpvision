// Verifies the scheduler secret sent in the `x-hook-secret` header by pg_cron
// jobs. The secret lives in a non-API database schema and is checked through a
// service-role-only function.
export async function verifyHookRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-hook-secret") ?? "";
  if (provided.length < 32) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("verify_hook_secret", { _secret: provided });
  return !error && data === true;
}

export function unauthorizedHook() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
