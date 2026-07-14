ALTER TABLE public.figure_snapshots
  ADD COLUMN label text NOT NULL DEFAULT '';
ALTER TABLE public.figure_snapshots ALTER COLUMN label DROP DEFAULT;