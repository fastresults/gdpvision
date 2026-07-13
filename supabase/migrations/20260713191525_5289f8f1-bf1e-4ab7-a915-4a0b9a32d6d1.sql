-- 1. Widen onboarding_runs.status to include 'needs_review'
ALTER TABLE public.onboarding_runs DROP CONSTRAINT IF EXISTS onboarding_runs_status_check;
ALTER TABLE public.onboarding_runs ADD CONSTRAINT onboarding_runs_status_check
  CHECK (status = ANY (ARRAY['queued','planning','searching','extracting','validating','ready','committed','failed','cancelled','stale','needs_review']));

-- 2. Add per-node plausibility cap (as multiple of GDP USD)
ALTER TABLE public.capital_flow_nodes ADD COLUMN IF NOT EXISTS gdp_cap_multiplier numeric NOT NULL DEFAULT 1.5;

-- Sensible per-node caps (based on typical share of GDP across small open economies)
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 1.20 WHERE node_key = 'TOURISM_SPEND';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.30 WHERE node_key = 'CBI_INFLOWS';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.50 WHERE node_key = 'FDI_NET';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.30 WHERE node_key = 'REMITTANCES';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.25 WHERE node_key = 'ODA_GRANTS';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.45 WHERE node_key = 'TAX_REVENUE';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.35 WHERE node_key = 'WAGES_AGRI';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.30 WHERE node_key = 'INFRA_CAPEX';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.30 WHERE node_key = 'DEBT_SERVICE';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.20 WHERE node_key = 'DIGITAL_HEALTH_CAPEX';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.25 WHERE node_key = 'ENERGY_IMPORT';
UPDATE public.capital_flow_nodes SET gdp_cap_multiplier = 0.80 WHERE node_key = 'IMPORT_LEAKAGE';