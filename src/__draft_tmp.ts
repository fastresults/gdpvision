import { draftIndicatorEvidence } from "@/lib/indices/evidence-draft.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("index_indicators").select("index_code,code").eq("source_kind","evidence").eq("status","active").order("index_code");
const skip=new Set(["incentive_statute","company_registration_fee","online_registration","building_permit_standard","icsid_convention","property_transfer_standard","new_york_convention","foi_law"]); const list = (data as {index_code:string;code:string}[]).filter(x=>!skip.has(x.code));
let i = 0;
async function worker() { while (i < list.length) { const x = list[i++]; try { const r = await draftIndicatorEvidence(x.index_code, x.code); console.log(x.index_code, x.code, "drafted", r.drafted, "nosource", r.noSource.length); } catch (e) { console.log(x.index_code, x.code, "FAIL", (e as Error).message); } } }
await Promise.all([worker(),worker(),worker(),worker()]);
console.log("DONE");
