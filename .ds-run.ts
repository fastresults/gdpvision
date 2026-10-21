import { createClient } from "@supabase/supabase-js";
import { deepScrapeSeries } from "./src/lib/events/deep-scrape.server.ts";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const [slug, edSlug] = process.argv.slice(2);
const { data: s } = await sb.from("event_series").select("id").eq("slug", slug).single();
let ed: { eventId: string; url: string } | undefined;
if (edSlug) { const { data: e } = await sb.from("events").select("id, site_url").eq("slug", edSlug).single(); ed = { eventId: e!.id, url: e!.site_url }; }
const r = await deepScrapeSeries(sb, s!.id, true, ed);
console.log(edSlug ?? slug, JSON.stringify((r as any).applied));
