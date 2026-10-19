-- Caribbean Indices: source fixes found by the first live run (19 Oct 2026).
-- Already applied to the database by hand; this file records them and is a
-- no-op when re-run.
--  · IMF DataMapper has no GGXONLB_NGDP (primary balance) series → overall
--    fiscal balance, GGXCNL_NGDP.
--  · World Bank moved PA.NUS.PPPC.RF (price level ratio) to the WDI archive.

DELETE FROM public.index_indicators WHERE index_code = 'CGX' AND code = 'primary_balance';

INSERT INTO public.index_indicators
  (index_code, code, pillar_code, name, unit, goal_best, goal_worst, log_scale, window_kind,
   source_kind, source_code, source_org, source_url, fallback, licence, licence_status,
   indicator_type, age_tolerance_years, status, position, notes)
VALUES
  ('CGX','fiscal_balance','stability','Overall fiscal balance (net lending/borrowing)','% GDP',1,-8,false,'latest',
   'imf_weo','GGXCNL_NGDP','IMF World Economic Outlook','https://www.imf.org/external/datamapper/GGXCNL_NGDP@WEO',
   'Budget estimates','IMF terms of use','to_confirm','data',3,'active',2,
   'Replaces primary balance: DataMapper has no GGXONLB_NGDP series')
ON CONFLICT (index_code, code) DO NOTHING;

UPDATE public.index_indicators
   SET status = 'pending_source',
       notes = 'World Bank moved PA.NUS.PPPC.RF to the WDI archive; needs an ICP source'
 WHERE index_code = 'CHX' AND code = 'price_level' AND status <> 'pending_source';
