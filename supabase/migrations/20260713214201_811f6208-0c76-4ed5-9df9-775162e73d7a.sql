create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('durable-onboarding-worker')
where exists (select 1 from cron.job where jobname = 'durable-onboarding-worker');

select cron.schedule(
  'durable-onboarding-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://gdpvision.lovable.app/api/public/hooks/onboarding-worker',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_Xf84ZQhNkD1MxqjSD_wFFg_1tkWk7dj"}'::jsonb,
    body := '{"limit":1}'::jsonb
  ) as request_id;
  $$
);