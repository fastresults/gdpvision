CREATE TABLE public.partner_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner text NOT NULL,
  label text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_hint text NOT NULL,
  countries text[] NOT NULL DEFAULT '{*}',
  scopes text[] NOT NULL DEFAULT '{}',
  allowed_origins text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  request_count bigint NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.partner_api_keys TO authenticated;
GRANT ALL ON public.partner_api_keys TO service_role;
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read partner keys" ON public.partner_api_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create partner keys" ON public.partner_api_keys FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update partner keys" ON public.partner_api_keys FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.resolve_partner_api_key(_key_hash text)
RETURNS TABLE(id uuid, partner text, label text, countries text[], scopes text[], allowed_origins text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.partner_api_keys k
     SET last_used_at = now(), request_count = k.request_count + 1
   WHERE k.key_hash = _key_hash AND k.revoked_at IS NULL AND k.expires_at > now()
  RETURNING k.id, k.partner, k.label, k.countries, k.scopes, k.allowed_origins;
END $$;
REVOKE ALL ON FUNCTION public.resolve_partner_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_partner_api_key(text) TO service_role;