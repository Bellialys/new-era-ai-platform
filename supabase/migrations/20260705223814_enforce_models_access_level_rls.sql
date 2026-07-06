-- Align direct Data API access to models with the server-side model catalog
-- access_level contract.

alter table public.models enable row level security;

drop policy if exists "Public can read active public models" on public.models;
drop policy if exists "Anon can read active anonymous models" on public.models;
drop policy if exists "Authenticated can read active allowed models" on public.models;

grant select on table public.models to anon, authenticated, service_role;

create policy "Anon can read active anonymous models"
on public.models
for select
to anon
using (
  is_active = true
  and access_level = 'anonymous'
);

create policy "Authenticated can read active allowed models"
on public.models
for select
to authenticated
using (
  is_active = true
  and (
    access_level in ('anonymous', 'registered')
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and (p.role = 'admin' or p.plan = 'pro')
    )
  )
);
