-- Pre-enable the independent exclusive talent slot for 情忆浮生.
-- Run after exclusive_talent_slot_migration_20260914.sql.
-- This does not change the player's ascension score and does not create a talent.

begin;

insert into public.exclusive_talent_slots (
  invite_code_hash,
  manual_enabled,
  enabled_note,
  enabled_at,
  updated_at
)
select
  p.invite_code_hash,
  true,
  '提前预开专属天赋槽，待达到 2500 分后测试',
  now(),
  now()
from public.player_profiles p
where p.display_name = '情忆浮生'
on conflict (invite_code_hash) do update
set
  manual_enabled = true,
  enabled_note = excluded.enabled_note,
  enabled_at = coalesce(exclusive_talent_slots.enabled_at, excluded.enabled_at),
  updated_at = now();

commit;

select
  p.display_name,
  p.ascension_score,
  s.invite_code_hash,
  s.manual_enabled,
  s.enabled_note,
  s.enabled_at
from public.player_profiles p
left join public.exclusive_talent_slots s
  on s.invite_code_hash = p.invite_code_hash
where p.display_name = '情忆浮生';
