DROP POLICY IF EXISTS "studies update" ON public.studies;

CREATE POLICY "studies update"
ON public.studies
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR owner_user_id = auth.uid()
  OR public.has_country_access(auth.uid(), country_code)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR owner_user_id = auth.uid()
  OR public.has_country_access(auth.uid(), country_code)
);