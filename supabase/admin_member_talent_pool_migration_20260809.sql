-- Curator member tools and talent warehouse support.
-- Run this in Supabase SQL Editor before deploying the matching Edge Function.
-- Safe to run more than once.

begin;

alter table public.invite_codes
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_action text;

alter table public.talent_pool_items
  add column if not exists effect text,
  add column if not exists action_cost integer not null default 0 check (action_cost >= 0),
  add column if not exists is_enabled boolean not null default true,
  add column if not exists admin_note text not null default '',
  add column if not exists created_by_hash text,
  add column if not exists updated_by_hash text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.talent_pool_items'::regclass
      and conname = 'talent_pool_items_rank_check'
  ) then
    alter table public.talent_pool_items drop constraint talent_pool_items_rank_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.talent_pool_items'::regclass
      and conname = 'talent_pool_items_rank_sabc_check'
  ) then
    alter table public.talent_pool_items
      add constraint talent_pool_items_rank_sabc_check check (rank in ('S', 'A', 'B', 'C'));
  end if;
end $$;

create index if not exists invite_codes_last_seen_idx
  on public.invite_codes(last_seen_at desc);

create index if not exists talent_pool_items_admin_idx
  on public.talent_pool_items(pool_key, is_enabled, rank, talent_id);

update public.talent_pool_items
set is_enabled = true
where is_enabled is null;

commit;

-- Verification.
select
  'invite_codes_activity_columns' as item,
  count(*) as columns_found
from information_schema.columns
where table_schema = 'public'
  and table_name = 'invite_codes'
  and column_name in ('last_seen_at', 'last_seen_action')
union all
select
  'talent_pool_admin_columns',
  count(*)
from information_schema.columns
where table_schema = 'public'
  and table_name = 'talent_pool_items'
  and column_name in ('is_enabled', 'admin_note', 'created_by_hash', 'updated_by_hash', 'updated_at');
