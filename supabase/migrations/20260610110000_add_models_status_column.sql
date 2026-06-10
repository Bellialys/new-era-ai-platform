-- Add a real public.models.status column for schema/documentation alignment.
--
-- The project already uses models.is_active to decide whether a model is
-- selectable. This generated column exposes the same lifecycle state in the
-- governance-friendly status format required by 32-model-catalog-governance.md
-- and checked by scripts/check-schema-sync.ts.

alter table public.models
  add column if not exists status text
  generated always as (
    case
      when is_active then 'active'
      else 'inactive'
    end
  ) stored;

comment on column public.models.status is
  'Generated model lifecycle status derived from is_active: active or inactive.';
