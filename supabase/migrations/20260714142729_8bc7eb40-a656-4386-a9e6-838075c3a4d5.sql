
ALTER VIEW public.series_freshness SET (security_invoker = true);
REVOKE EXECUTE ON FUNCTION public.log_series_grade_downgrade() FROM PUBLIC, authenticated, anon;
