ALTER TABLE public.counsel_answers
  ADD COLUMN IF NOT EXISTS evidence_state text,
  ADD COLUMN IF NOT EXISTS evidence_reason text,
  ADD COLUMN IF NOT EXISTS parent_answer_id uuid REFERENCES public.counsel_answers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS research_sources jsonb NOT NULL DEFAULT '[]'::jsonb;