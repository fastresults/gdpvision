-- Caribbean Indices: CGX (Growth), CHX (Human), CGV (Governance), CCX (Capital)
-- and the Sextant confidence rating.
-- Method: docs/prd/PRD-caribbean-indices.md. Scoring: src/lib/indices/scoring.ts.
--
-- The method layer (specs, pillars, indicators) is public reference data.
-- Runs, inputs and scores are written only by the service role (the runner);
-- the public API serves scores from published releases only.

-- ------------------------------------------------------------------ method
CREATE TABLE IF NOT EXISTS public.index_specs (
  code text PRIMARY KEY CHECK (code IN ('CGX','CHX','CGV','CCX')),
  name text NOT NULL,
  pillar_label text NOT NULL,           -- GDP · Human Quality · Governance · Investment
  question text NOT NULL,
  benchmark text NOT NULL,              -- the global index it answers
  method_version integer NOT NULL DEFAULT 0,
  method_status text NOT NULL DEFAULT 'draft' CHECK (method_status IN ('draft','frozen')),
  aggregation text NOT NULL DEFAULT 'geometric' CHECK (aggregation IN ('geometric','arithmetic')),
  pillar_coverage_min numeric NOT NULL DEFAULT 0.667,
  external_composite_cap numeric NOT NULL DEFAULT 0.20,
  position integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.index_pillars (
  index_code text NOT NULL REFERENCES public.index_specs(code) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  position integer NOT NULL,
  PRIMARY KEY (index_code, code)
);

CREATE TABLE IF NOT EXISTS public.index_indicators (
  index_code text NOT NULL REFERENCES public.index_specs(code) ON DELETE CASCADE,
  code text NOT NULL,
  pillar_code text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  -- score = 100 × (x − worst) / (best − worst), clipped to 0–100; works for either direction
  goal_best numeric NOT NULL,
  goal_worst numeric NOT NULL,
  log_scale boolean NOT NULL DEFAULT false,
  window_kind text NOT NULL DEFAULT 'latest' CHECK (window_kind IN ('latest','mean5','sd10','band_distance')),
  band_low numeric,
  band_high numeric,
  source_kind text NOT NULL CHECK (source_kind IN ('wdi','imf_weo','kpi','evidence')),
  source_code text,                     -- WDI / IMF code, or kpi_code
  source_org text NOT NULL,
  source_url text,
  fallback text,
  licence text NOT NULL,
  licence_status text NOT NULL DEFAULT 'to_confirm' CHECK (licence_status IN ('confirmed','to_confirm')),
  indicator_type text NOT NULL DEFAULT 'data' CHECK (indicator_type IN ('data','documentary','external_assessment','external_composite')),
  age_tolerance_years integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_source')),
  weight numeric NOT NULL DEFAULT 1,
  position integer NOT NULL,
  notes text,
  PRIMARY KEY (index_code, code),
  FOREIGN KEY (index_code, pillar_code) REFERENCES public.index_pillars(index_code, code) ON DELETE CASCADE,
  CHECK (goal_best <> goal_worst)
);

-- Documentary and external-assessment values, entered with their evidence.
-- Only verified rows feed a run.
CREATE TABLE IF NOT EXISTS public.index_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  index_code text NOT NULL,
  indicator_code text NOT NULL,
  country_code text NOT NULL,
  value numeric NOT NULL,
  period text NOT NULL,                 -- year the fact refers to, e.g. '2025'
  document_title text NOT NULL,
  document_url text NOT NULL CHECK (document_url ~ '^https://'),
  document_date date,
  publisher text NOT NULL,
  grade char(1) NOT NULL CHECK (grade IN ('A','B','C','D')),
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  entered_by uuid DEFAULT auth.uid(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (index_code, indicator_code) REFERENCES public.index_indicators(index_code, code) ON DELETE CASCADE,
  UNIQUE (index_code, indicator_code, country_code, period)
);

-- Two-person rule, enforced in the database (not only in the server function):
-- a new row is never verified; the verifier is the caller and is not the person
-- who entered it; any change to the fact or its evidence clears verification.
CREATE OR REPLACE FUNCTION public.index_evidence_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
-- runs as the caller (not SECURITY DEFINER), so current_user is the request's role
DECLARE is_service boolean := current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF NOT is_service THEN
      NEW.entered_by := auth.uid();
      NEW.verified := false; NEW.verified_by := NULL; NEW.verified_at := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NOT is_service THEN
    NEW.entered_by := OLD.entered_by;
  END IF;
  IF (NEW.value, NEW.period, NEW.document_url, NEW.document_title, NEW.publisher, NEW.grade, NEW.country_code, NEW.indicator_code, NEW.index_code)
     IS DISTINCT FROM (OLD.value, OLD.period, OLD.document_url, OLD.document_title, OLD.publisher, OLD.grade, OLD.country_code, OLD.indicator_code, OLD.index_code) THEN
    NEW.verified := false; NEW.verified_by := NULL; NEW.verified_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.verified AND NOT OLD.verified AND NOT is_service THEN
    IF auth.uid() IS NULL OR auth.uid() IS NOT DISTINCT FROM NEW.entered_by THEN
      RAISE EXCEPTION 'A second person must verify evidence.';
    END IF;
    NEW.verified_by := auth.uid(); NEW.verified_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS index_evidence_guard ON public.index_evidence;
CREATE TRIGGER index_evidence_guard BEFORE INSERT OR UPDATE ON public.index_evidence
  FOR EACH ROW EXECUTE FUNCTION public.index_evidence_guard();

-- ------------------------------------------------------------------ runs
CREATE TABLE IF NOT EXISTS public.index_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('manual','scheduled')),
  mode text NOT NULL CHECK (mode IN ('watch','tracker','edition')),
  data_cutoff date NOT NULL DEFAULT current_date,
  method_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Frozen copy of every value a run used (or excluded, with the reason).
CREATE TABLE IF NOT EXISTS public.index_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.index_runs(id) ON DELETE CASCADE,
  index_code text NOT NULL,
  indicator_code text NOT NULL,
  country_code text NOT NULL,
  raw_value numeric,
  value_used numeric,
  period text,
  score numeric,
  source_kind text NOT NULL,
  source_org text,
  source_url text,
  licence text,
  grade char(1) CHECK (grade IN ('A','B','C','D')),
  method text CHECK (method IN ('reported','derived')),
  age_years integer,
  source_ok boolean NOT NULL DEFAULT true,
  excluded_reason text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, index_code, indicator_code, country_code)
);
CREATE INDEX IF NOT EXISTS index_inputs_run_country ON public.index_inputs (run_id, country_code);

CREATE TABLE IF NOT EXISTS public.index_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.index_runs(id) ON DELETE CASCADE,
  index_code text NOT NULL,
  country_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('scored','not_scored')),
  score numeric,
  rank integer,
  pillar_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  not_scored_reason text,
  sextant numeric,
  sextant_band text CHECK (sextant_band IN ('clear','fair','hazy','obscured')),
  sextant_parts jsonb NOT NULL DEFAULT '{}'::jsonb,
  weakest_grade char(1),
  method_version integer NOT NULL,
  UNIQUE (run_id, index_code, country_code)
);

CREATE TABLE IF NOT EXISTS public.index_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.index_runs(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('tracker','edition')),
  label text NOT NULL,                  -- e.g. '2026-10 tracker', 'April 2027 edition'
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','withdrawn')),
  signed_off_by uuid[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  notes text,
  changelog jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- only an official edition, signed off, is ever public
  CHECK (status <> 'published' OR (kind = 'edition' AND cardinality(signed_off_by) >= 1 AND published_at IS NOT NULL))
);

-- ------------------------------------------------------------------ grants + RLS
GRANT SELECT ON public.index_specs, public.index_pillars, public.index_indicators TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.index_evidence TO authenticated;
GRANT SELECT ON public.index_runs, public.index_inputs, public.index_scores, public.index_releases TO authenticated;
GRANT ALL ON public.index_specs, public.index_pillars, public.index_indicators, public.index_evidence,
  public.index_runs, public.index_inputs, public.index_scores, public.index_releases TO service_role;

ALTER TABLE public.index_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "index specs readable" ON public.index_specs;
CREATE POLICY "index specs readable" ON public.index_specs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "index pillars readable" ON public.index_pillars;
CREATE POLICY "index pillars readable" ON public.index_pillars FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "index indicators readable" ON public.index_indicators;
CREATE POLICY "index indicators readable" ON public.index_indicators FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "index evidence stewards read" ON public.index_evidence;
CREATE POLICY "index evidence stewards read" ON public.index_evidence FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "index evidence stewards write" ON public.index_evidence;
CREATE POLICY "index evidence stewards write" ON public.index_evidence FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "index evidence stewards update" ON public.index_evidence;
CREATE POLICY "index evidence stewards update" ON public.index_evidence FOR UPDATE TO authenticated
  USING (public.is_admin_or_steward(auth.uid())) WITH CHECK (public.is_admin_or_steward(auth.uid()));

DROP POLICY IF EXISTS "index runs stewards read" ON public.index_runs;
CREATE POLICY "index runs stewards read" ON public.index_runs FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "index inputs stewards read" ON public.index_inputs;
CREATE POLICY "index inputs stewards read" ON public.index_inputs FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "index scores stewards read" ON public.index_scores;
CREATE POLICY "index scores stewards read" ON public.index_scores FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "index releases stewards read" ON public.index_releases;
CREATE POLICY "index releases stewards read" ON public.index_releases FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));

-- A published official edition is public: any signed-in user (and the MCP server,
-- which acts as the user) may read it. Trackers and drafts stay with stewards.
DROP POLICY IF EXISTS "published index releases readable" ON public.index_releases;
CREATE POLICY "published index releases readable" ON public.index_releases FOR SELECT TO authenticated USING (status = 'published');
DROP POLICY IF EXISTS "published index scores readable" ON public.index_scores;
CREATE POLICY "published index scores readable" ON public.index_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.index_releases r WHERE r.run_id = index_scores.run_id AND r.status = 'published'));
DROP POLICY IF EXISTS "published index inputs readable" ON public.index_inputs;
CREATE POLICY "published index inputs readable" ON public.index_inputs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.index_releases r WHERE r.run_id = index_inputs.run_id AND r.status = 'published'));

-- ------------------------------------------------------------------ seed: indexes
INSERT INTO public.index_specs (code, name, pillar_label, question, benchmark, position) VALUES
  ('CGX','Caribbean Growth Index','GDP','How strong, diversified and well-measured is the economy?','IMD World Competitiveness Ranking (economic performance)',1),
  ('CHX','Caribbean Human Index','Human Quality','Does growth reach people?','UNDP Human Development Index',2),
  ('CGV','Caribbean Governance Index','Governance','Does the state deliver what it budgets, accountably?','World Bank Worldwide Governance Indicators; Transparency International CPI',3),
  ('CCX','Caribbean Capital Index','Investment','How easily can capital and firms enter, operate and stay?','World Bank Business Ready (B-READY)',4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, pillar_label = EXCLUDED.pillar_label, question = EXCLUDED.question,
  benchmark = EXCLUDED.benchmark, position = EXCLUDED.position, updated_at = now();

INSERT INTO public.index_pillars (index_code, code, name, position) VALUES
  ('CGX','output','Output and growth',1),
  ('CGX','stability','Fiscal and external stability',2),
  ('CGX','diversification','Diversification',3),
  ('CHX','health','Health',1),
  ('CHX','education','Education and skills',2),
  ('CHX','income','Income and work',3),
  ('CHX','living','Living conditions',4),
  ('CGV','delivery','Delivery',1),
  ('CGV','accountability','Accountability',2),
  ('CGV','integrity','Financial integrity and standing',3),
  ('CCX','entry','Business entry and operation',1),
  ('CCX','protection','Investor protection and legal certainty',2),
  ('CCX','capital','Capital flows and market depth',3)
ON CONFLICT (index_code, code) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position;

-- ------------------------------------------------------------------ seed: indicators
-- Goalposts are method version 0 (draft): set from published policy targets where
-- one exists, otherwise from the plausible range for small states. The methodology
-- panel ratifies them before the first official edition freezes the method.
INSERT INTO public.index_indicators
  (index_code, code, pillar_code, name, unit, goal_best, goal_worst, log_scale, window_kind, band_low, band_high,
   source_kind, source_code, source_org, source_url, fallback, licence, licence_status, indicator_type,
   age_tolerance_years, status, position, notes)
VALUES
  -- CGX · Growth
  ('CGX','real_growth_5y','output','Real GDP growth, 5-year average','%',6,-2,false,'mean5',NULL,NULL,
   'imf_weo','NGDP_RPCH','IMF World Economic Outlook','https://www.imf.org/external/datamapper/NGDP_RPCH@WEO','National statistics office','IMF terms of use','to_confirm','data',3,'active',1,'Actual years only; WEO projections excluded'),
  ('CGX','gdp_pc_ppp','output','GDP per capita, PPP','current international $',75000,1000,true,'latest',NULL,NULL,
   'wdi','NY.GDP.PCAP.PP.CD','World Bank WDI','https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD','IMF WEO (PPPPC)','CC BY 4.0','confirmed','data',3,'active',2,NULL),
  ('CGX','growth_volatility','output','Growth volatility, 10-year standard deviation','pp',0,10,false,'sd10',NULL,NULL,
   'imf_weo','NGDP_RPCH','IMF World Economic Outlook','https://www.imf.org/external/datamapper/NGDP_RPCH@WEO',NULL,'IMF terms of use','to_confirm','data',3,'active',3,'Derived from the WEO real growth series'),
  ('CGX','inflation_band','output','Inflation, distance from the 2–4% band','pp',0,10,false,'band_distance',2,4,
   'imf_weo','PCPIPCH','IMF World Economic Outlook','https://www.imf.org/external/datamapper/PCPIPCH@WEO','ECCB, central banks','IMF terms of use','to_confirm','data',3,'active',4,NULL),
  ('CGX','public_debt','stability','Gross public debt','% GDP',30,120,false,'latest',NULL,NULL,
   'imf_weo','GGXWDG_NGDP','IMF World Economic Outlook','https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO','ECCB, finance ministry','IMF terms of use','to_confirm','data',3,'active',1,'ECCU target is 60% of GDP by 2035'),
  ('CGX','primary_balance','stability','Primary balance','% GDP',3,-5,false,'latest',NULL,NULL,
   'imf_weo','GGXONLB_NGDP','IMF World Economic Outlook','https://www.imf.org/external/datamapper/GGXONLB_NGDP@WEO','Budget estimates','IMF terms of use','to_confirm','data',3,'active',2,NULL),
  ('CGX','current_account','stability','Current account balance','% GDP',2,-20,false,'latest',NULL,NULL,
   'imf_weo','BCA_NGDPD','IMF World Economic Outlook','https://www.imf.org/external/datamapper/BCA_NGDPD@WEO','ECCB, central banks','IMF terms of use','to_confirm','data',3,'active',3,NULL),
  ('CGX','reserves_months','stability','Total reserves','months of imports',6,1,false,'latest',NULL,NULL,
   'wdi','FI.RES.TOTL.MO','World Bank WDI','https://data.worldbank.org/indicator/FI.RES.TOTL.MO','ECCB (ECCU members)','CC BY 4.0','confirmed','data',3,'active',4,NULL),
  ('CGX','sector_concentration','diversification','Sector concentration of GDP (Herfindahl index)','index 0–1',0.10,0.40,false,'latest',NULL,NULL,
   'evidence',NULL,'National accounts by sector; ECCB','https://www.eccb-centralbank.org/statistics','ECLAC CEPALSTAT','Publisher terms','to_confirm','data',3,'pending_source',1,'Blocked: country_sectors is AI-sourced today; needs national accounts at grade A–C'),
  ('CGX','export_concentration','diversification','Export concentration index','index 0–1',0.10,0.70,false,'latest',NULL,NULL,
   'evidence',NULL,'UNCTADstat','https://unctadstat.unctad.org','UN Comtrade','UNCTAD terms','to_confirm','data',3,'pending_source',2,NULL),
  ('CGX','tourism_dependence','diversification','Tourism receipts','% GDP',5,60,false,'latest',NULL,NULL,
   'evidence',NULL,'UN Tourism / CTO','https://www.unwto.org/tourism-statistics','WDI (ST.INT.RCPT.CD)','Publisher terms','to_confirm','data',3,'pending_source',3,NULL),

  -- CHX · Human
  ('CHX','life_expectancy','health','Life expectancy at birth','years',85,60,false,'latest',NULL,NULL,
   'wdi','SP.DYN.LE00.IN','World Bank WDI','https://data.worldbank.org/indicator/SP.DYN.LE00.IN','UN DESA World Population Prospects','CC BY 4.0','confirmed','data',3,'active',1,NULL),
  ('CHX','under5_mortality','health','Under-5 mortality','per 1,000 live births',2,40,false,'latest',NULL,NULL,
   'wdi','SH.DYN.MORT','World Bank WDI (UN IGME)','https://data.worldbank.org/indicator/SH.DYN.MORT','PAHO','CC BY 4.0','confirmed','data',3,'active',2,NULL),
  ('CHX','ncd_mortality','health','Premature NCD mortality, ages 30–70 (SDG 3.4.1)','%',10,30,false,'latest',NULL,NULL,
   'evidence','NCDMORT3070','WHO Global Health Observatory','https://www.who.int/data/gho','PAHO','WHO terms','to_confirm','data',3,'pending_source',3,'WHO GHO API client not built yet'),
  ('CHX','uhc_coverage','health','UHC service coverage index','index 0–100',90,40,false,'latest',NULL,NULL,
   'evidence','UHC_INDEX_REPORTED','WHO Global Health Observatory','https://www.who.int/data/gho',NULL,'WHO terms','to_confirm','external_composite',3,'pending_source',4,NULL),
  ('CHX','lower_secondary_completion','education','Lower-secondary completion rate','%',100,50,false,'latest',NULL,NULL,
   'wdi','SE.SEC.CMPT.LO.ZS','World Bank WDI (UNESCO UIS)','https://data.worldbank.org/indicator/SE.SEC.CMPT.LO.ZS','Ministry of education','CC BY 4.0','confirmed','data',3,'active',1,NULL),
  ('CHX','tertiary_enrolment','education','Tertiary gross enrolment ratio','%',80,5,false,'latest',NULL,NULL,
   'wdi','SE.TER.ENRR','World Bank WDI (UNESCO UIS)','https://data.worldbank.org/indicator/SE.TER.ENRR','Ministry of education','CC BY 4.0','confirmed','data',3,'active',2,NULL),
  ('CHX','csec_pass_rate','education','CSEC pass rate, five subjects incl. English and maths','%',80,20,false,'latest',NULL,NULL,
   'evidence',NULL,'Caribbean Examinations Council','https://www.cxc.org','Ministry of education','CXC terms','to_confirm','documentary',3,'pending_source',3,NULL),
  ('CHX','gni_pc_ppp','income','GNI per capita, PPP','current international $',75000,1000,true,'latest',NULL,NULL,
   'wdi','NY.GNP.PCAP.PP.CD','World Bank WDI','https://data.worldbank.org/indicator/NY.GNP.PCAP.PP.CD','UNDP HDR data','CC BY 4.0','confirmed','data',3,'active',1,NULL),
  ('CHX','unemployment','income','Unemployment rate','% labour force',3,25,false,'latest',NULL,NULL,
   'wdi','SL.UEM.TOTL.ZS','World Bank WDI (ILOSTAT)','https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS','National labour force survey','CC BY 4.0','confirmed','data',3,'active',2,'ILO estimates published by a multilateral are taken as reported, grade C'),
  ('CHX','youth_unemployment','income','Youth unemployment rate, ages 15–24','% youth labour force',8,45,false,'latest',NULL,NULL,
   'wdi','SL.UEM.1524.ZS','World Bank WDI (ILOSTAT)','https://data.worldbank.org/indicator/SL.UEM.1524.ZS','National labour force survey','CC BY 4.0','confirmed','data',3,'active',3,NULL),
  ('CHX','poverty_national','income','Poverty headcount, national poverty line','% population',0,40,false,'latest',NULL,NULL,
   'wdi','SI.POV.NAHC','World Bank WDI','https://data.worldbank.org/indicator/SI.POV.NAHC','National Survey of Living Conditions','CC BY 4.0','confirmed','data',5,'active',4,'Household surveys are infrequent; tolerance 5 years'),
  ('CHX','price_level','living','Price level ratio (PPP factor ÷ exchange rate)','ratio',0.5,1.3,false,'latest',NULL,NULL,
   'wdi','PA.NUS.PPPC.RF','World Bank WDI (ICP)','https://data.worldbank.org/indicator/PA.NUS.PPPC.RF','ICP','CC BY 4.0','confirmed','data',3,'active',1,NULL),
  ('CHX','homicide_rate','living','Intentional homicides','per 100,000',1,50,false,'latest',NULL,NULL,
   'wdi','VC.IHR.PSRC.P5','World Bank WDI (UNODC)','https://data.worldbank.org/indicator/VC.IHR.PSRC.P5','National police statistics','CC BY 4.0','confirmed','data',3,'active',2,NULL),
  ('CHX','internet_users','living','Internet users','% population',100,30,false,'latest',NULL,NULL,
   'wdi','IT.NET.USER.ZS','World Bank WDI (ITU)','https://data.worldbank.org/indicator/IT.NET.USER.ZS','National regulator','CC BY 4.0','confirmed','data',3,'active',3,NULL),

  -- CGV · Governance
  ('CGV','pefa_outturn','delivery','Budget outturn vs approved budget (PEFA PI-1, PI-2)','score 1–4 (D–A)',4,1,false,'latest',NULL,NULL,
   'evidence',NULL,'PEFA assessment reports','https://www.pefa.org/assessments','Budget estimates + public accounts','PEFA terms','to_confirm','external_assessment',6,'active',1,'PEFA assessments are periodic; tolerance 6 years'),
  ('CGV','budget_timing','delivery','Budget tabled before the fiscal year starts','days late (negative = early)',-30,120,false,'latest',NULL,NULL,
   'evidence',NULL,'Hansard; published budget',NULL,'Finance ministry site','Government document (cited)','confirmed','documentary',2,'active',2,NULL),
  ('CGV','wgi_government_effectiveness','delivery','Government Effectiveness (external composite)','score 0–100',100,0,false,'latest',NULL,NULL,
   'wdi','GOV_WGI_GE_SC','World Bank Worldwide Governance Indicators','https://data.worldbank.org/indicator/GOV_WGI_GE_SC',NULL,'CC BY 4.0','confirmed','external_composite',3,'active',3,'Revised 0–100 scale (2025 method)'),
  ('CGV','egov_development','delivery','E-Government Development Index (external composite)','index 0–1',1,0.3,false,'latest',NULL,NULL,
   'evidence',NULL,'UN DESA','https://publicadministration.un.org/egovkb',NULL,'UN terms','to_confirm','external_composite',3,'active',4,NULL),
  ('CGV','accounts_tabled_lag','accountability','Public accounts audited and tabled','months after year-end',9,36,false,'latest',NULL,NULL,
   'evidence',NULL,'Auditor-General reports; Hansard',NULL,'Parliament site','Government document (cited)','confirmed','documentary',2,'active',1,NULL),
  ('CGV','auditor_general_report','accountability','Latest Auditor-General annual report published','years since',1,5,false,'latest',NULL,NULL,
   'evidence',NULL,'Auditor-General office',NULL,'Parliament site','Government document (cited)','confirmed','documentary',2,'active',2,NULL),
  ('CGV','foi_law','accountability','Freedom of Information law in force','1 = yes, 0 = no',1,0,false,'latest',NULL,NULL,
   'evidence',NULL,'Statute; gazette',NULL,NULL,'Government document (cited)','confirmed','documentary',10,'active',3,NULL),
  ('CGV','integrity_commission_report','accountability','Integrity Commission annual report published','years since',1,5,false,'latest',NULL,NULL,
   'evidence',NULL,'Integrity Commission',NULL,'Parliament site','Government document (cited)','confirmed','documentary',2,'active',4,NULL),
  ('CGV','cfatf_technical_compliance','integrity','FATF Recommendations rated Compliant or Largely Compliant','% of 40',100,40,false,'latest',NULL,NULL,
   'evidence',NULL,'CFATF mutual evaluation and follow-up reports','https://www.cfatf-gafic.org',NULL,'CFATF terms','to_confirm','external_assessment',8,'active',1,NULL),
  ('CGV','global_forum_rating','integrity','OECD Global Forum exchange-of-information rating','1 = Non-compliant … 4 = Compliant',4,1,false,'latest',NULL,NULL,
   'evidence',NULL,'OECD Global Forum peer reviews','https://www.oecd.org/tax/transparency',NULL,'OECD terms','to_confirm','external_assessment',8,'active',2,NULL),
  ('CGV','eu_list','integrity','On the EU list of non-cooperative tax jurisdictions','1 = listed, 0 = not listed',0,1,false,'latest',NULL,NULL,
   'evidence',NULL,'Council of the EU','https://www.consilium.europa.eu/en/policies/eu-list-of-non-cooperative-jurisdictions/',NULL,'EU reuse policy','confirmed','documentary',1,'active',3,NULL),
  ('CGV','fatf_increased_monitoring','integrity','On the FATF list of jurisdictions under increased monitoring','1 = listed, 0 = not listed',0,1,false,'latest',NULL,NULL,
   'evidence',NULL,'FATF','https://www.fatf-gafi.org',NULL,'FATF terms','to_confirm','documentary',1,'active',4,NULL),

  -- CCX · Capital
  ('CCX','company_registration_fee','entry','Official fee to register a company','% GNI per capita',0,30,false,'latest',NULL,NULL,
   'evidence',NULL,'Companies registry fee schedule',NULL,'Registry website','Government document (cited)','confirmed','documentary',3,'active',1,NULL),
  ('CCX','online_registration','entry','Company registration available fully online','1 = yes, 0 = no',1,0,false,'latest',NULL,NULL,
   'evidence',NULL,'Companies registry',NULL,NULL,'Government document (cited)','confirmed','documentary',2,'active',2,NULL),
  ('CCX','building_permit_standard','entry','Published service standard for a building permit','days',30,365,false,'latest',NULL,NULL,
   'evidence',NULL,'Planning authority',NULL,'Development control regulations','Government document (cited)','confirmed','documentary',3,'active',3,NULL),
  ('CCX','property_transfer_standard','entry','Published service standard to register a property transfer','days',7,180,false,'latest',NULL,NULL,
   'evidence',NULL,'Land registry',NULL,'Statute','Government document (cited)','confirmed','documentary',3,'active',4,NULL),
  ('CCX','investment_agreements','protection','Treaties with investment provisions in force','count',20,0,false,'latest',NULL,NULL,
   'evidence',NULL,'UNCTAD Investment Policy Hub','https://investmentpolicy.unctad.org/international-investment-agreements',NULL,'UNCTAD terms','to_confirm','external_assessment',3,'active',1,NULL),
  ('CCX','new_york_convention','protection','Party to the New York Convention on arbitral awards','1 = yes, 0 = no',1,0,false,'latest',NULL,NULL,
   'evidence',NULL,'UNCITRAL status table','https://uncitral.un.org/en/texts/arbitration/conventions/foreign_arbitral_awards/status2',NULL,'UN terms','to_confirm','documentary',10,'active',2,NULL),
  ('CCX','icsid_convention','protection','ICSID Convention in force','1 = yes, 0 = no',1,0,false,'latest',NULL,NULL,
   'evidence',NULL,'ICSID member list','https://icsid.worldbank.org/about/member-states/database-of-member-states',NULL,'World Bank terms','to_confirm','documentary',10,'active',3,NULL),
  ('CCX','incentive_statute','protection','Investment incentive regime published in statute','1 = yes, 0 = no',1,0,false,'latest',NULL,NULL,
   'evidence',NULL,'Investment act; gazette',NULL,'Investment promotion agency','Government document (cited)','confirmed','documentary',10,'active',4,NULL),
  ('CCX','fdi_inflows_5y','capital','FDI net inflows, 5-year average','% GDP',12,0,false,'mean5',NULL,NULL,
   'wdi','BX.KLT.DINV.WD.GD.ZS','World Bank WDI','https://data.worldbank.org/indicator/BX.KLT.DINV.WD.GD.ZS','UNCTAD World Investment Report','CC BY 4.0','confirmed','data',3,'active',1,NULL),
  ('CCX','private_credit','capital','Domestic credit to private sector','% GDP',100,10,false,'latest',NULL,NULL,
   'wdi','FS.AST.PRVT.GD.ZS','World Bank WDI','https://data.worldbank.org/indicator/FS.AST.PRVT.GD.ZS','ECCB, central banks','CC BY 4.0','confirmed','data',3,'active',2,NULL),
  ('CCX','trade_openness','capital','Trade openness','trade % GDP',150,40,false,'latest',NULL,NULL,
   'wdi','NE.TRD.GNFS.ZS','World Bank WDI','https://data.worldbank.org/indicator/NE.TRD.GNFS.ZS','UNCTADstat','CC BY 4.0','confirmed','data',3,'active',3,NULL),
  ('CCX','sovereign_rating','capital','Sovereign credit rating','notches above default (0–20)',20,0,false,'latest',NULL,NULL,
   'evidence',NULL,'Rating-agency press releases','https://www.caricris.com','CariCRIS','Proprietary — reproduction to confirm','to_confirm','external_assessment',2,'pending_source',4,'Hold until reproduction rights are confirmed')
ON CONFLICT (index_code, code) DO UPDATE SET
  pillar_code = EXCLUDED.pillar_code, name = EXCLUDED.name, unit = EXCLUDED.unit,
  goal_best = EXCLUDED.goal_best, goal_worst = EXCLUDED.goal_worst, log_scale = EXCLUDED.log_scale,
  window_kind = EXCLUDED.window_kind, band_low = EXCLUDED.band_low, band_high = EXCLUDED.band_high,
  source_kind = EXCLUDED.source_kind, source_code = EXCLUDED.source_code, source_org = EXCLUDED.source_org,
  source_url = EXCLUDED.source_url, fallback = EXCLUDED.fallback, licence = EXCLUDED.licence,
  licence_status = EXCLUDED.licence_status, indicator_type = EXCLUDED.indicator_type,
  age_tolerance_years = EXCLUDED.age_tolerance_years, status = EXCLUDED.status,
  position = EXCLUDED.position, notes = EXCLUDED.notes;

-- ------------------------------------------------------------------ partner scope
-- Every active partner key (today: GDP Advisor's) gets the new `indices` resource.
UPDATE public.partner_api_keys
   SET scopes = array_append(scopes, 'indices')
 WHERE revoked_at IS NULL AND expires_at > now() AND NOT ('indices' = ANY (scopes));

-- ------------------------------------------------------------------ schedules
-- Weekly source watch (Mondays 05:10 UTC) and monthly provisional tracker (2nd, 05:20 UTC).
DO $$ BEGIN PERFORM cron.unschedule('caribbean-indices-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('caribbean-indices-monthly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'caribbean-indices-weekly',
  '10 5 * * 1',
  $CRON$
  SELECT net.http_post(
    url:='https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/indices',
    headers:=jsonb_build_object('Content-Type','application/json','x-hook-secret',(SELECT secret FROM internal.hook_secrets WHERE name='cron')),
    body:='{"mode":"watch"}'::jsonb,
    timeout_milliseconds:=120000
  );
  $CRON$
);

SELECT cron.schedule(
  'caribbean-indices-monthly',
  '20 5 2 * *',
  $CRON$
  SELECT net.http_post(
    url:='https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/indices',
    headers:=jsonb_build_object('Content-Type','application/json','x-hook-secret',(SELECT secret FROM internal.hook_secrets WHERE name='cron')),
    body:='{"mode":"tracker"}'::jsonb,
    timeout_milliseconds:=120000
  );
  $CRON$
);
