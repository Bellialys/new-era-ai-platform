-- Migration: models_access_level
-- v0.6.2 — Model Access Levels
--
-- Adds access_level column to models table.
-- Values:
--   anonymous  — available to guests and authenticated users (all current free models)
--   registered — requires an authenticated account
--   premium    — reserved for future paid/extended access tier
--
-- All existing models are free and remain accessible to guests, so we default
-- to 'anonymous'. Future paid models will be inserted with 'registered' or 'premium'.

alter table public.models
  add column if not exists access_level text not null default 'anonymous';

alter table public.models
  add constraint models_access_level_check
  check (access_level in ('anonymous', 'registered', 'premium'));

-- All currently active free models stay 'anonymous'
update public.models
  set access_level = 'anonymous'
  where price_label = 'free';

-- Index for fast catalog queries filtered by access_level
create index if not exists models_access_level_idx
  on public.models (access_level)
  where is_active = true and is_public = true;

comment on column public.models.access_level is
  'Who can see and use this model: anonymous (guests + users), registered (auth only), premium (paid tier).';
