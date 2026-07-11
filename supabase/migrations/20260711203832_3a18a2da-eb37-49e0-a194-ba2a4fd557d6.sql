
DROP POLICY IF EXISTS "Anyone can submit a briefing request" ON public.briefing_requests;
CREATE POLICY "diag insert" ON public.briefing_requests FOR INSERT TO PUBLIC WITH CHECK (true);
