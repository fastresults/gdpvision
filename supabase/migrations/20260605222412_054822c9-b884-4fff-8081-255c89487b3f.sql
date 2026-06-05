CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read settings" ON public.app_settings FOR SELECT USING (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('admin_title', 'EyeFrame Admin'),
  ('kiosk_title', 'EyeFrame'),
  ('label_websites', 'Websites'),
  ('label_presentations', 'Presentations'),
  ('label_docs', 'Google Docs');
