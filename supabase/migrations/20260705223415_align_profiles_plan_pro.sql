-- Align profile plan values with the runtime authorization model.
-- Canonical paid plan value is "pro"; old "premium" values are migrated.

update public.profiles
set plan = 'pro'
where plan = 'premium';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro'));

comment on column public.profiles.plan is
  'Subscription plan: free (default) or pro.';
