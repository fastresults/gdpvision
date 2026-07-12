create table if not exists public.instance_config (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

grant select on public.instance_config to authenticated;
grant all on public.instance_config to service_role;

alter table public.instance_config enable row level security;

create policy "instance_config_read_authenticated"
  on public.instance_config for select
  to authenticated
  using (true);

create policy "instance_config_write_admin"
  on public.instance_config for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.instance_config (key, value_json)
values ('counsel.limits', jsonb_build_object(
  'perUserPerHour', 30,
  'perScopePerDay', 500
))
on conflict (key) do nothing;

create index if not exists counsel_answers_user_created_at_idx
  on public.counsel_answers (user_id, created_at desc);
create index if not exists counsel_answers_scope_created_at_idx
  on public.counsel_answers (scope_key, created_at desc);