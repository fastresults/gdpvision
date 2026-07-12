CREATE TABLE public.citations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('strategy', 'comms', 'counsel')),
    owner_id UUID NOT NULL,
    memory_object_id UUID REFERENCES public.memory_objects(id) ON DELETE SET NULL,
    quote TEXT,
    bucket TEXT,
    position_offset INTEGER DEFAULT 0,
    scope_key TEXT NOT NULL,
    sector_code TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.citations TO authenticated;
GRANT ALL ON public.citations TO service_role;

ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage citations in their scope" ON public.citations
  FOR ALL
  TO authenticated
  USING (
    scope_key IN (
      SELECT scope_key FROM public.instance_bindings WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  )
  WITH CHECK (
    scope_key IN (
      SELECT scope_key FROM public.instance_bindings WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_citations_updated_at
  BEFORE UPDATE ON public.citations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_citations_owner ON public.citations(owner_type, owner_id);
CREATE INDEX idx_citations_scope ON public.citations(scope_key, sector_code);
CREATE INDEX idx_citations_memory ON public.citations(memory_object_id);