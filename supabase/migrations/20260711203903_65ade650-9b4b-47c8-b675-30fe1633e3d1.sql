
DROP POLICY IF EXISTS "diag insert" ON public.briefing_requests;

CREATE POLICY "Anyone can submit a briefing request"
  ON public.briefing_requests
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 200
    AND length(btrim(role)) BETWEEN 1 AND 200
    AND length(btrim(government)) BETWEEN 1 AND 200
    AND length(btrim(nation)) BETWEEN 1 AND 100
    AND length(btrim(email)) BETWEEN 3 AND 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND (message IS NULL OR length(message) <= 5000)
    AND status = 'new'
  );
