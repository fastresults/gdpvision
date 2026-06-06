import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SettingKey =
  | "admin_title"
  | "kiosk_title"
  | "label_websites"
  | "label_presentations"
  | "label_docs"
  | "label_videos"
  | "label_brand";

export const SETTING_KEYS: SettingKey[] = [
  "admin_title",
  "kiosk_title",
  "label_websites",
  "label_presentations",
  "label_docs",
  "label_videos",
  "label_brand",
];

export type Settings = Record<SettingKey, string>;

const DEFAULTS: Settings = {
  admin_title: "EyeFrame Admin",
  kiosk_title: "EyeFrame",
  label_websites: "Websites",
  label_presentations: "Presentations",
  label_docs: "Google Docs",
  label_videos: "Past Events",
  label_brand: "Brand Building",
};

export const listSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_settings").select("key,value");
  if (error) throw new Error(error.message);
  const out: Settings = { ...DEFAULTS };
  for (const row of data ?? []) {
    if ((SETTING_KEYS as string[]).includes(row.key)) {
      out[row.key as SettingKey] = row.value;
    }
  }
  return out;
});

export const updateSetting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.enum([
          "admin_title",
          "kiosk_title",
          "label_websites",
          "label_presentations",
          "label_docs",
          "label_videos",
          "label_brand",
        ]),
        value: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
