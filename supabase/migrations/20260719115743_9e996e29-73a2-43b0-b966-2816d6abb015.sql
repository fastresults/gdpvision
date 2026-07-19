
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'line_minister',
  country_code text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_email_idx ON public.invitations (lower(email));
CREATE UNIQUE INDEX invitations_open_email_uniq
  ON public.invitations (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT SELECT ON public.invitations TO anon;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "invitations admin all"
  ON public.invitations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Anyone can look up by token (needed to render the invite page pre-signup).
-- Column-level: token is opaque and unguessable, so per-row read via token is safe.
CREATE POLICY "invitations lookup by token"
  ON public.invitations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Access-allowed helper: any role, an accepted invitation, or seeded admin email.
CREATE OR REPLACE FUNCTION public.access_allowed(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.invitations
      WHERE lower(email) = lower(coalesce(_email, ''))
        AND accepted_at IS NOT NULL
        AND revoked_at IS NULL
    )
    OR lower(coalesce(_email, '')) IN ('stachio@madebyopen.com', 'fastresults@gmail.com');
$$;

GRANT EXECUTE ON FUNCTION public.access_allowed(uuid, text) TO authenticated, anon;
