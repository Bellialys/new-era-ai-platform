-- Migration: profiles_extend_v0_6_4
-- v0.6.4 — Profile MVP: extend profiles table with additional fields

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text,
  add column if not exists role text not null default 'user',
  add column if not exists plan text not null default 'free';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin'));

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'premium'));

comment on column public.profiles.first_name is 'User first name (optional).';
comment on column public.profiles.last_name is 'User last name (optional).';
comment on column public.profiles.avatar_url is 'URL to profile avatar stored in Supabase Storage avatars bucket.';
comment on column public.profiles.role is 'App role: user (default) or admin.';
comment on column public.profiles.plan is 'Subscription plan: free (default) or premium.';
