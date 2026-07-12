-- If the account already exists, promote now.
INSERT INTO public.user_roles (user_id, role, country_code)
SELECT u.id, 'admin'::public.app_role, NULL
FROM auth.users u
WHERE lower(u.email) = 'stachio@madebyopen.com'
ON CONFLICT (user_id, role, country_code) DO NOTHING;

-- Auto-grant super-admin on future signup / email confirmation.
CREATE OR REPLACE FUNCTION public.grant_admin_for_seeded_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.email, '')) IN ('stachio@madebyopen.com', 'fastresults@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role, country_code)
    VALUES (NEW.id, 'admin'::public.app_role, NULL)
    ON CONFLICT (user_id, role, country_code) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_super_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_seeded_emails();