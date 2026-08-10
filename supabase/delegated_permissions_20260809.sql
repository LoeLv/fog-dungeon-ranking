-- Delegated permissions for non-curator staff.
-- Run after the existing member/talent-pool migration.
-- Permissions are stored on invite_codes and are resolved by invite hash in the Edge Function.

begin;

alter table public.invite_codes
  add column if not exists permissions text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.invite_codes'::regclass
      and conname = 'invite_codes_permissions_check'
  ) then
    alter table public.invite_codes
      add constraint invite_codes_permissions_check
      check (permissions <@ array[
        'talent_pool_manage',
        'settle_scores',
        'account_role_manage',
        'review_dungeons'
      ]::text[]);
  end if;
end $$;

-- Clear only the four delegated permissions before reapplying this roster.
-- This makes the roster idempotent while preserving any future unrelated metadata.
update public.invite_codes
set permissions = array(
  select item
  from unnest(coalesce(permissions, '{}'::text[])) as item
  where item not in (
    'talent_pool_manage',
    'settle_scores',
    'account_role_manage',
    'review_dungeons'
  )
);

with roster(display_name, permissions) as (
  values
    ('羔羊', array['talent_pool_manage', 'account_role_manage', 'review_dungeons']::text[]),
    ('槐柏', array['account_role_manage', 'review_dungeons']::text[]),
    ('南河书淮', array['account_role_manage', 'review_dungeons']::text[]),
    ('慕辞', array['settle_scores', 'account_role_manage', 'review_dungeons']::text[]),
    ('棺材板', array['account_role_manage', 'review_dungeons']::text[]),
    ('我不想死', array['account_role_manage', 'review_dungeons']::text[]),
    ('情忆浮生', array['settle_scores', 'account_role_manage', 'review_dungeons']::text[]),
    ('知更', array['settle_scores', 'account_role_manage', 'review_dungeons']::text[]),
    ('变态', array['account_role_manage', 'review_dungeons']::text[]),
    ('墨染流年', array['account_role_manage', 'review_dungeons']::text[])
),
matched as (
  select distinct target.code_hash, r.display_name, r.permissions
  from roster r
  join (
    select code_hash, display_name
    from public.invite_codes
    union
    select invite_code_hash as code_hash, display_name
    from public.player_profiles
  ) target on target.display_name = r.display_name
)
update public.invite_codes i
set permissions = m.permissions
from matched m
where i.code_hash = m.code_hash;

commit;

-- Verification: this should return one row per matched account.
select display_name, role, permissions
from public.invite_codes
where display_name in (
  '羔羊',
  '慕辞',
  '槐柏',
  '南河书淮',
  '慕辞',
  '棺材板',
  '我不想死',
  '情忆浮生',
  '知更',
  '变态',
  '墨染流年'
)
order by display_name;

with roster(display_name) as (
  values
    ('羔羊'),
    ('槐柏'),
    ('南河书淮'),
    ('慕辞'),
    ('棺材板'),
    ('我不想死'),
    ('情忆浮生'),
    ('知更'),
    ('变态'),
    ('墨染流年')
),
matched as (
  select distinct target.display_name
  from roster r
  join (
    select display_name
    from public.invite_codes
    union
    select display_name
    from public.player_profiles
  ) target on target.display_name = r.display_name
)
select r.display_name as missing_staff_name
from roster r
left join matched m on m.display_name = r.display_name
where m.display_name is null
order by r.display_name;
