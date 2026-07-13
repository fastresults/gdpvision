
-- Capital-flow registry (global, seeded once)
CREATE TABLE public.capital_flow_nodes (
  node_key text PRIMARY KEY,
  label text NOT NULL,
  side text NOT NULL CHECK (side IN ('input','output')),
  sort_order int NOT NULL DEFAULT 100,
  hue_token text,
  sector_code text,
  preferred_sources text[] NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.capital_flow_nodes TO anon, authenticated;
GRANT ALL ON public.capital_flow_nodes TO service_role;
ALTER TABLE public.capital_flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read flow node registry" ON public.capital_flow_nodes FOR SELECT USING (true);
CREATE POLICY "Admins write flow nodes" ON public.capital_flow_nodes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_capital_flow_nodes_updated_at BEFORE UPDATE ON public.capital_flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-country per-period value with citations
CREATE TABLE public.country_capital_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  node_key text NOT NULL REFERENCES public.capital_flow_nodes(node_key) ON DELETE RESTRICT,
  period text NOT NULL,
  value_usd_m numeric NOT NULL,
  method text NOT NULL DEFAULT 'reported' CHECK (method IN ('reported','derived','modelled','residual')),
  confidence_grade char(1) NOT NULL DEFAULT 'C',
  provenance text NOT NULL DEFAULT 'verified',
  notes text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, node_key, period)
);
GRANT SELECT ON public.country_capital_flows TO authenticated;
GRANT ALL ON public.country_capital_flows TO service_role;
ALTER TABLE public.country_capital_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read flows" ON public.country_capital_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write flows" ON public.country_capital_flows FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_country_capital_flows_updated_at BEFORE UPDATE ON public.country_capital_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX country_capital_flows_country_period_idx ON public.country_capital_flows (country_code, period);

-- Seed the canonical registry
INSERT INTO public.capital_flow_nodes (node_key, label, side, sort_order, hue_token, sector_code, preferred_sources, description) VALUES
  ('TOURISM_SPEND',       'Gross Tourism Spend',            'input',  10, 'sector-01', 'TOU', ARRAY['UNWTO','CTO','IMF Article IV','ECCB BOP'],        'Balance of Payments — travel credits.'),
  ('CBI_INFLOWS',         'CBI Inflows',                    'input',  20, 'sector-04', NULL,  ARRAY['CIU Annual Report','Ministry of Finance Budget'], 'Citizenship-by-Investment fiscal receipts.'),
  ('FDI_NET',             'Foreign Direct Investment',      'input',  30, 'sector-05', NULL,  ARRAY['UNCTAD FDI/STAT','IMF BOP'],                      'Net FDI inflows.'),
  ('REMITTANCES',         'Remittances',                    'input',  40, 'sector-06', NULL,  ARRAY['World Bank KNOMAD','IMF BOP'],                    'Personal remittances received (BOP).'),
  ('ODA_GRANTS',          'ODA & Grants',                   'input',  50, 'sector-07', NULL,  ARRAY['OECD DAC','World Bank WDI'],                      'Official development assistance, grants.'),
  ('TAX_REVENUE',         'Tax Revenue',                    'input',  60, 'sector-08', NULL,  ARRAY['IMF Article IV','Ministry of Finance Budget'],    'Domestic tax revenue.'),
  ('WAGES_AGRI',          'Local Wages / Agriculture',      'output', 10, 'sector-03', 'AGR', ARRAY['Ministry of Finance Estimates','FAO'],            'Public wage bill plus agri value-add.'),
  ('INFRA_CAPEX',         'Public Works & Infrastructure',  'output', 20, 'sector-02', 'CON', ARRAY['Ministry of Finance Estimates','CDB'],            'Infrastructure capital expenditure.'),
  ('DEBT_SERVICE',        'External Debt Service',          'output', 30, 'sector-09', NULL,  ARRAY['World Bank IDS','IMF Article IV'],                'Principal + interest on external debt.'),
  ('DIGITAL_HEALTH_CAPEX','Digital & Health CapEx',         'output', 40, 'sector-10', 'HEA', ARRAY['Ministry of Finance Estimates','WHO'],            'Digital and health capital expenditure.'),
  ('ENERGY_IMPORT',       'Energy & Utilities Import',      'output', 50, 'sector-11', 'ENE', ARRAY['IEA','IMF BOP','Central Bank'],                   'Fuel and utility imports.'),
  ('IMPORT_LEAKAGE',      'Import Leakages',                'output', 60, 'sector-12', NULL,  ARRAY['UN Comtrade','IMF BOP'],                          'Residual merchandise imports.'),
  ('RECONCILIATION_RESIDUAL','Unattributed Residual',       'output', 99, 'sector-default', NULL, ARRAY[]::text[],                                     'Auto-balancer when input/output sums diverge.');
