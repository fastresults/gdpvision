CREATE TABLE public.calculator_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  organisation TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.calculator_leads TO service_role;

ALTER TABLE public.calculator_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX calculator_leads_created_at_idx ON public.calculator_leads (created_at DESC);