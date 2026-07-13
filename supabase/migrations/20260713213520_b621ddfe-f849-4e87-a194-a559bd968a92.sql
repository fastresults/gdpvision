create table if not exists public.onboarding_jobs (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  mode text not null default 'pending' check (mode in ('pending','rerun','single-stage')),
  status text not null default 'queued' check (status in ('queued','running','blocked','needs_review','completed','failed','cancelled','stale')),
  current_stage text,
  started_by uuid,
  heartbeat_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  progress jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

grant select, insert, update, delete on public.onboarding_jobs to authenticated;
grant all on public.onboarding_jobs to service_role;

alter table public.onboarding_jobs enable row level security;

drop policy if exists "Admins can manage onboarding jobs" on public.onboarding_jobs;
create policy "Admins can manage onboarding jobs"
on public.onboarding_jobs
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists onboarding_jobs_country_created_idx on public.onboarding_jobs(country_code, created_at desc);
create unique index if not exists onboarding_jobs_one_active_per_country on public.onboarding_jobs(country_code) where status in ('queued','running');

create table if not exists public.onboarding_job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.onboarding_jobs(id) on delete cascade,
  country_code text not null references public.countries(code) on delete cascade,
  stage text not null,
  step_key text not null,
  step_type text not null default 'stage',
  status text not null default 'queued' check (status in ('queued','running','blocked','needs_review','completed','failed','cancelled','stale','skipped')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  heartbeat_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  checkpoint jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  not_before timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, stage, step_key)
);

grant select, insert, update, delete on public.onboarding_job_steps to authenticated;
grant all on public.onboarding_job_steps to service_role;

alter table public.onboarding_job_steps enable row level security;

drop policy if exists "Admins can manage onboarding job steps" on public.onboarding_job_steps;
create policy "Admins can manage onboarding job steps"
on public.onboarding_job_steps
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists onboarding_job_steps_job_status_idx on public.onboarding_job_steps(job_id, status, stage, step_key);
create index if not exists onboarding_job_steps_country_stage_idx on public.onboarding_job_steps(country_code, stage, updated_at desc);
create index if not exists onboarding_job_steps_runnable_idx on public.onboarding_job_steps(status, not_before, lease_expires_at);

create table if not exists public.onboarding_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.onboarding_jobs(id) on delete cascade,
  step_id uuid references public.onboarding_job_steps(id) on delete cascade,
  country_code text not null references public.countries(code) on delete cascade,
  event_type text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.onboarding_job_events to authenticated;
grant all on public.onboarding_job_events to service_role;

alter table public.onboarding_job_events enable row level security;

drop policy if exists "Admins can manage onboarding job events" on public.onboarding_job_events;
create policy "Admins can manage onboarding job events"
on public.onboarding_job_events
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists onboarding_job_events_job_created_idx on public.onboarding_job_events(job_id, created_at desc);

create or replace function public.touch_onboarding_job_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_onboarding_jobs_updated_at on public.onboarding_jobs;
create trigger touch_onboarding_jobs_updated_at
before update on public.onboarding_jobs
for each row execute function public.touch_onboarding_job_updated_at();

drop trigger if exists touch_onboarding_job_steps_updated_at on public.onboarding_job_steps;
create trigger touch_onboarding_job_steps_updated_at
before update on public.onboarding_job_steps
for each row execute function public.touch_onboarding_job_updated_at();