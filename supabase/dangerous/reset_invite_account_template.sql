-- Full account reset template for one invite-bound account.
-- Replace only the two values below, then run the whole script from the top.
-- This keeps authored dungeons, but removes the target user's personal activity/state.
-- The invite is restored to an active player code and can be bound again.
--
-- IMPORTANT:
-- 1. Run the preview SELECT first and confirm the identity/counts.
-- 2. Then run the complete transaction block.
-- 3. Do not run only a selected statement from the transaction block.

-- =========================
-- 1) Read-only preview
-- =========================
select
  'invite_codes' as source,
  i.code_hash,
  i.display_name,
  i.role,
  i.is_active,
  i.last_used_at
from public.invite_codes i
where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
union all
select
  'player_profiles' as source,
  p.invite_code_hash as code_hash,
  p.display_name,
  p.role,
  null::boolean as is_active,
  null::timestamptz as last_used_at
from public.player_profiles p
where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
order by source, code_hash;

select 'player_profiles' as item, count(*)::bigint as rows
from public.player_profiles p
where p.invite_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p2.invite_code_hash from public.player_profiles p2
  where p2.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'profile_titles', count(*)::bigint
from public.profile_titles t
where t.invite_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
or t.granted_by_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'profile_curses', count(*)::bigint
from public.profile_curses c
where c.invite_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
or c.granted_by_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'owned_talents', count(*)::bigint from public.owned_talents
where invite_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'talent_draw_state', count(*)::bigint from public.talent_draw_state
where invite_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'score_messages', count(*)::bigint from public.score_messages
where player_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'match_queue', count(*)::bigint from public.match_queue
where player_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
)
union all
select 'match_room_players', count(*)::bigint from public.match_room_players
where player_code_hash in (
  select i.code_hash from public.invite_codes i
  where i.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
  union
  select p.invite_code_hash from public.player_profiles p
  where p.display_name = 'REPLACE_WITH_CURRENT_DISPLAY_NAME'
);

-- =========================
-- 2) Destructive reset
-- =========================
begin;

do $reset$
declare
  target_display_name text := 'REPLACE_WITH_CURRENT_DISPLAY_NAME';
  reset_display_name text := 'REPLACE_WITH_RESET_DISPLAY_NAME';
  target_hashes text[];
  affected_settlement_ids uuid[];
begin
  select coalesce(array_agg(distinct code_hash), '{}'::text[])
  into target_hashes
  from (
    select i.code_hash
    from public.invite_codes i
    where i.display_name = target_display_name
    union
    select p.invite_code_hash
    from public.player_profiles p
    where p.display_name = target_display_name
  ) matched;

  if coalesce(array_length(target_hashes, 1), 0) = 0 then
    raise exception '未找到目标账号：%', target_display_name;
  end if;

  select coalesce(array_agg(distinct settlement_id), '{}'::uuid[])
  into affected_settlement_ids
  from public.score_settlement_entries
  where player_code_hash = any(target_hashes)
    and settlement_id is not null;

  update public.comments
  set is_deleted = true,
      deleted_at = now(),
      updated_at = now(),
      content = '此用户数据已清除'
  where invite_code_hash = any(target_hashes);

  delete from public.ratings where invite_code_hash = any(target_hashes);
  delete from public.clear_records where invite_code_hash = any(target_hashes);
  delete from public.match_queue where player_code_hash = any(target_hashes);
  delete from public.match_muster_participants where player_code_hash = any(target_hashes);
  delete from public.match_room_players where player_code_hash = any(target_hashes);
  delete from public.match_musters where creator_code_hash = any(target_hashes);

  delete from public.score_messages where player_code_hash = any(target_hashes);
  delete from public.score_change_logs where player_code_hash = any(target_hashes);

  delete from public.score_settlement_entries
  where player_code_hash = any(target_hashes);

  delete from public.score_settlements s
  where s.id = any(affected_settlement_ids)
    and not exists (
      select 1
      from public.score_settlement_entries e
      where e.settlement_id = s.id
    );

  delete from public.profile_titles
  where invite_code_hash = any(target_hashes)
     or granted_by_hash = any(target_hashes);

  delete from public.profile_curses
  where invite_code_hash = any(target_hashes)
     or granted_by_hash = any(target_hashes);

  delete from public.talent_overflow_choices where invite_code_hash = any(target_hashes);
  delete from public.talent_draw_logs where invite_code_hash = any(target_hashes);
  delete from public.talent_exchange_logs where invite_code_hash = any(target_hashes);
  delete from public.owned_talents where invite_code_hash = any(target_hashes);
  delete from public.talent_pool_counters where invite_code_hash = any(target_hashes);
  delete from public.talent_draw_state where invite_code_hash = any(target_hashes);
  delete from public.user_fragments where invite_code_hash = any(target_hashes);
  delete from public.player_profiles where invite_code_hash = any(target_hashes);

  update public.invite_codes
  set display_name = reset_display_name,
      role = 'player',
      is_active = true,
      last_used_at = null,
      note = concat_ws(' | ', nullif(note, ''), 'account reset')
  where code_hash = any(target_hashes);
end
$reset$;

commit;

-- =========================
-- 3) Post-reset verification
-- =========================
select
  code_hash,
  display_name,
  role,
  is_active,
  last_used_at,
  note
from public.invite_codes
where display_name = 'REPLACE_WITH_RESET_DISPLAY_NAME';

select 'player_profiles_after' as item, count(*)::bigint as rows
from public.player_profiles
where display_name in (
  'REPLACE_WITH_CURRENT_DISPLAY_NAME',
  'REPLACE_WITH_RESET_DISPLAY_NAME'
)
union all
select 'active_reset_invites', count(*)::bigint
from public.invite_codes
where display_name = 'REPLACE_WITH_RESET_DISPLAY_NAME'
  and role = 'player'
  and is_active = true
  and last_used_at is null;
