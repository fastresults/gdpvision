DROP POLICY IF EXISTS "narrative_lineage readable" ON public.narrative_lineage;
CREATE POLICY "narrative_lineage readable" ON public.narrative_lineage FOR SELECT TO authenticated USING (
  public.is_admin_or_steward(auth.uid()) OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.intake_items i WHERE i.id = signal_id)
);