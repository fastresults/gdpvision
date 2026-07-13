
-- Drop durable-job scheduler and tables. Onboarding is now driven sequentially from the admin UI.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'durable-onboarding-worker') then
    perform cron.unschedule('durable-onboarding-worker');
  end if;
exception when others then null;
end $$;

drop table if exists public.onboarding_job_events cascade;
drop table if exists public.onboarding_job_steps cascade;
drop table if exists public.onboarding_jobs cascade;
drop function if exists public.touch_onboarding_job_updated_at() cascade;
