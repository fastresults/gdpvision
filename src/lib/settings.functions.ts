import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_SETTINGS, type SettingKey, type Settings } from "./kiosk-types";

export const SETTING_KEYS: SettingKey[] = [
  "admin_title",
  "kiosk_title",
  "label_websites",
  "label_presentations",
  "label_docs",
  "label_videos",
  "label_brand",
  "idle_image_url",
];

export { DEFAULT_SETTINGS, type SettingKey, type Settings };

export const listSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_settings").select("key,value");
  if (error) throw new Error(error.message);
  const out: Settings = { ...DEFAULT_SETTINGS };
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
          "idle_image_url",
        ]),
        value: z.string().max(2000),
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
