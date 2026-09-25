CREATE TABLE public.reporting_standards (
  code text PRIMARY KEY,
  name text NOT NULL,
  body text NOT NULL,
  category text NOT NULL,
  summary text,
  url text,
  version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reporting_standards TO authenticated;
GRANT ALL ON public.reporting_standards TO service_role;
ALTER TABLE public.reporting_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read standards" ON public.reporting_standards FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write standards" ON public.reporting_standards FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.standard_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL REFERENCES public.reporting_standards(code) ON DELETE CASCADE,
  req_key text NOT NULL,
  label text NOT NULL,
  clause text,
  frequency text NOT NULL DEFAULT 'annual',
  max_lag_months integer NOT NULL DEFAULT 12,
  impact text NOT NULL DEFAULT 'medium',
  kpi_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standard_code, req_key)
);
GRANT SELECT ON public.standard_requirements TO authenticated;
GRANT ALL ON public.standard_requirements TO service_role;
ALTER TABLE public.standard_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reqs" ON public.standard_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write reqs" ON public.standard_requirements FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.collection_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  requirement_id uuid NOT NULL REFERENCES public.standard_requirements(id) ON DELETE CASCADE,
  owner_agency text,
  method text NOT NULL DEFAULT 'administrative records',
  cadence text NOT NULL DEFAULT 'annual',
  validation_rules text,
  due_date date,
  status text NOT NULL DEFAULT 'draft',
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, requirement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_protocols TO authenticated;
GRANT ALL ON public.collection_protocols TO service_role;
ALTER TABLE public.collection_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access protocols" ON public.collection_protocols FOR ALL TO authenticated USING (public.has_country_access(auth.uid(), country_code)) WITH CHECK (public.has_country_access(auth.uid(), country_code));
CREATE TRIGGER collection_protocols_updated BEFORE UPDATE ON public.collection_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.investment_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  title text NOT NULL,
  sector text,
  structure text,
  stage text NOT NULL DEFAULT 'concept',
  capex_usd numeric,
  revenue_model text,
  sponsor text,
  beneficial_owners text,
  es_category text,
  summary text,
  risks text,
  climate_alignment text,
  aml_cleared boolean NOT NULL DEFAULT false,
  feasibility_done boolean NOT NULL DEFAULT false,
  land_secured boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'draft',
  approved_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_projects TO authenticated;
GRANT ALL ON public.investment_projects TO service_role;
ALTER TABLE public.investment_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access investments" ON public.investment_projects FOR ALL TO authenticated USING (public.has_country_access(auth.uid(), country_code)) WITH CHECK (public.has_country_access(auth.uid(), country_code));
CREATE TRIGGER investment_projects_updated BEFORE UPDATE ON public.investment_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.reporting_standards (code,name,body,category,summary,url) VALUES
('IMF_EGDDS','Enhanced General Data Dissemination System','IMF','Macro statistics','Baseline dissemination of real, fiscal, financial, external and population data.','https://dsbb.imf.org/'),
('IMF_SDDS','Special Data Dissemination Standard','IMF','Macro statistics','Higher-frequency, timelier macro data for market-access economies.','https://dsbb.imf.org/'),
('GFSM_2014','Government Finance Statistics Manual 2014','IMF','Fiscal','Revenue, expenditure, balance and debt of general government.','https://www.imf.org/external/np/sta/gfsm/'),
('BPM6','Balance of Payments Manual 6','IMF','External sector','Current account, FDI and external position.','https://www.imf.org/external/pubs/ft/bop/2007/bopman6.htm'),
('SNA_2008','System of National Accounts','UN','National accounts','GDP, growth and income measures.','https://unstats.un.org/unsd/nationalaccount/sna2008.asp'),
('UN_SDG','SDG Indicator Framework','UN','Development','Poverty, health, energy and climate indicators.','https://unstats.un.org/sdgs/indicators/'),
('WB_SPI','Statistical Performance Indicators','World Bank','Statistical capacity','Data use, services, products, sources and infrastructure.','https://www.worldbank.org/en/programs/statistical-performance-indicators'),
('FATF','FATF Recommendations','FATF / CFATF','Integrity','AML/CFT, beneficial ownership transparency — relevant to CBI.','https://www.fatf-gafi.org/'),
('PEFA','Public Expenditure and Financial Accountability','PEFA Secretariat','Public finance management','Budget credibility, transparency and reporting.','https://www.pefa.org/');

INSERT INTO public.standard_requirements (standard_code,req_key,label,clause,frequency,max_lag_months,impact,kpi_codes) VALUES
('IMF_EGDDS','gdp','GDP (nominal and real growth)','Real sector','annual',12,'high','{real_gdp_growth,gdp_per_capita_current_usd}'),
('IMF_EGDDS','cpi','Consumer price index','Real sector','monthly',2,'high','{cpi_yoy}'),
('IMF_EGDDS','labour','Labour market (unemployment)','Real sector','annual',12,'medium','{unemployment_rate}'),
('IMF_EGDDS','population','Population','Socio-demographic','annual',12,'medium','{population}'),
('IMF_EGDDS','fiscal','Central government operations','Fiscal sector','quarterly',6,'high','{primary_balance_gdp,govt_revenue_gdp}'),
('IMF_EGDDS','debt','Central government debt','Fiscal sector','quarterly',6,'high','{debt_gdp}'),
('IMF_EGDDS','bop','Balance of payments','External sector','quarterly',6,'high','{current_account_gdp}'),
('IMF_SDDS','gdp_q','Quarterly GDP','Real sector','quarterly',3,'high','{real_gdp_growth}'),
('IMF_SDDS','cpi_m','Monthly CPI','Real sector','monthly',1,'high','{cpi_yoy}'),
('GFSM_2014','revenue','General government revenue','Ch. 5','annual',12,'high','{govt_revenue_gdp}'),
('GFSM_2014','balance','Primary balance','Ch. 4','annual',12,'high','{primary_balance_gdp}'),
('GFSM_2014','gg_debt','Gross debt','Ch. 7','annual',12,'high','{debt_gdp}'),
('BPM6','ca','Current account balance','Ch. 10','quarterly',6,'high','{current_account_gdp}'),
('BPM6','fdi','Direct investment flows','Ch. 6','annual',12,'high','{fdi_net_inflows_gdp}'),
('BPM6','exports','Exports of goods and services','Ch. 10','annual',12,'medium','{exports_of_goods_and_services}'),
('BPM6','travel','Travel services (tourism)','Ch. 10','monthly',3,'medium','{tourism_arrivals}'),
('SNA_2008','gdp_pc','GDP per capita','Ch. 2','annual',12,'medium','{gdp_per_capita_current_usd,gdp_per_capita_ppp}'),
('UN_SDG','sdg1','1.1 / 1.2 Poverty headcount','Goal 1','annual',36,'medium','{poverty_headcount}'),
('UN_SDG','sdg3','3 Life expectancy','Goal 3','annual',24,'low','{life_expectancy}'),
('UN_SDG','sdg7','7.2 Renewable energy share','Goal 7','annual',24,'medium','{renewable_energy_share}'),
('UN_SDG','sdg13','13 CO2 emissions','Goal 13','annual',24,'low','{co2_emissions_per_capita}'),
('WB_SPI','hdi','Human development outcomes','Pillar 3','annual',24,'low','{hdi}'),
('FATF','bo_register','Beneficial ownership register','R.24','continuous',0,'high','{}'),
('FATF','cbi_dd','CBI applicant due-diligence reporting','R.10 / R.24','quarterly',3,'high','{}'),
('PEFA','budget_outturn','Budget outturn vs approved budget','PI-1','annual',12,'medium','{}'),
('PEFA','in_year_reports','In-year budget execution reports','PI-28','quarterly',3,'medium','{}');