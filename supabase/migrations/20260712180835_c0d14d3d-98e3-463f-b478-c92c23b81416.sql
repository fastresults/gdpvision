
ALTER TABLE public.onboarding_runs DROP CONSTRAINT IF EXISTS onboarding_runs_stage_check;
ALTER TABLE public.onboarding_runs ADD CONSTRAINT onboarding_runs_stage_check CHECK (
  stage = ANY (ARRAY[
    'profile','gdp','sector_composition','ministries','ministry_sector_map',
    'source_registry','kpi_seed','sector_dossier','ministry_deep_dive','corpus_ingest','second_brain_seed'
  ])
);
