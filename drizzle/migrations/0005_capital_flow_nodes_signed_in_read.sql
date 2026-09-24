DROP POLICY IF EXISTS "Read flow node registry" ON public.capital_flow_nodes;
REVOKE SELECT ON public.capital_flow_nodes FROM anon;
CREATE POLICY "Signed-in read flow node registry" ON public.capital_flow_nodes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);