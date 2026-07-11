
-- Profiles ------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  title TEXT,
  default_country_code TEXT REFERENCES public.countries(code) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Instance bindings ---------------------------------------------------
CREATE TABLE public.instance_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE RESTRICT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, country_code)
);
GRANT SELECT ON public.instance_bindings TO authenticated;
GRANT ALL ON public.instance_bindings TO service_role;
ALTER TABLE public.instance_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own instance bindings"
  ON public.instance_bindings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage bindings"
  ON public.instance_bindings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Series --------------------------------------------------------------
CREATE TABLE public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE RESTRICT,
  sector_code TEXT NOT NULL REFERENCES public.sectors(code) ON DELETE RESTRICT,
  metric TEXT NOT NULL,
  unit TEXT NOT NULL,
  frequency TEXT NOT NULL,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  confidence_grade CHAR(1) NOT NULL DEFAULT 'C',
  methodology_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, sector_code, metric)
);
CREATE INDEX idx_series_country_sector ON public.series (country_code, sector_code);
GRANT SELECT ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Series readable by authenticated users"
  ON public.series FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards manage series"
  ON public.series FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_series_updated
  BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Series points -------------------------------------------------------
CREATE TABLE public.series_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  value NUMERIC NOT NULL,
  revised_from NUMERIC,
  revised_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, period)
);
CREATE INDEX idx_series_points_series_period ON public.series_points (series_id, period DESC);
GRANT SELECT ON public.series_points TO authenticated;
GRANT ALL ON public.series_points TO service_role;
ALTER TABLE public.series_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Series points readable by authenticated users"
  ON public.series_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards manage series points"
  ON public.series_points FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));

-- CBI Exposure Index --------------------------------------------------
CREATE TABLE public.exposure_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  period DATE NOT NULL,
  value NUMERIC NOT NULL,
  decomposition JSONB NOT NULL DEFAULT '{}'::jsonb,
  methodology_ref TEXT,
  confidence_grade CHAR(1) NOT NULL DEFAULT 'C',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, period)
);
GRANT SELECT ON public.exposure_index TO authenticated;
GRANT ALL ON public.exposure_index TO service_role;
ALTER TABLE public.exposure_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exposure index readable by authenticated users"
  ON public.exposure_index FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards manage exposure index"
  ON public.exposure_index FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));

-- Data revisions audit ------------------------------------------------
CREATE TABLE public.data_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  period DATE,
  previous_value NUMERIC,
  new_value NUMERIC,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_revisions TO authenticated;
GRANT ALL ON public.data_revisions TO service_role;
ALTER TABLE public.data_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit readable by authenticated users"
  ON public.data_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards write audit rows"
  ON public.data_revisions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));
