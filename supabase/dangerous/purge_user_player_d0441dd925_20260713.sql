-- Purge user data for display name/player label: player-d0441dd925
-- Run the preview section first. Run the transaction section only after the target hash looks correct.
-- This keeps authored dungeons themselves, to avoid deleting public dungeon content and other users' comments/ratings.

-- 1) Preview target identity and affected row counts.
with target as (
  select code_hash as invite_code_hash, display_name, role, 'invite_codes' as source
  from public.invite_codes
  where display_name = 'player-d0441dd925'
  union
  select invite_code_hash, display_name, role, 'player_profiles' as source
  from public.player_profiles
  where display_name = 'player-d0441dd925'
),
target_hash as (
  select distinct invite_code_hash from target
)
select 'target_identity' as item, count(*)::bigint as rows
from target
union all select 'player_profiles', count(*) from public.player_profiles where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'profile_titles', count(*) from public.profile_titles where invite_code_hash in (select invite_code_hash from target_hash) or granted_by_hash in (select invite_code_hash from target_hash)
union all select 'profile_curses', count(*) from public.profile_curses where invite_code_hash in (select invite_code_hash from target_hash) or granted_by_hash in (select invite_code_hash from target_hash)
union all select 'owned_talents', count(*) from public.owned_talents where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'talent_overflow_choices', count(*) from public.talent_overflow_choices where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'talent_draw_state', count(*) from public.talent_draw_state where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'talent_pool_counters', count(*) from public.talent_pool_counters where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'talent_draw_logs', count(*) from public.talent_draw_logs where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'talent_exchange_logs', count(*) from public.talent_exchange_logs where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'user_fragments', count(*) from public.user_fragments where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'score_settlement_entries', count(*) from public.score_settlement_entries where player_code_hash in (select invite_code_hash from target_hash)
union all select 'score_change_logs', count(*) from public.score_change_logs where player_code_hash in (select invite_code_hash from target_hash)
union all select 'score_messages', count(*) from public.score_messages where player_code_hash in (select invite_code_hash from target_hash)
union all select 'match_queue', count(*) from public.match_queue where player_code_hash in (select invite_code_hash from target_hash)
union all select 'match_room_players', count(*) from public.match_room_players where player_code_hash in (select invite_code_hash from target_hash)
union all select 'match_muster_participants', count(*) from public.match_muster_participants where player_code_hash in (select invite_code_hash from target_hash)
union all select 'match_musters_created', count(*) from public.match_musters where creator_code_hash in (select invite_code_hash from target_hash)
union all select 'clear_records', count(*) from public.clear_records where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'ratings', count(*) from public.ratings where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'comments', count(*) from public.comments where invite_code_hash in (select invite_code_hash from target_hash)
union all select 'authored_dungeons_kept', count(*) from public.dungeons where invite_code_hash in (select invite_code_hash from target_hash);

-- Optional detail preview:
select *
from public.player_profiles
where display_name = 'player-d0441dd925'
   or invite_code_hash in (
    select code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  );

select id, display_name, role, is_active, created_at
from public.invite_codes
where display_name = 'player-d0441dd925';

-- 2) Transaction purge.
-- Uncomment and run after previewing the target.
/*
begin;

with target_hash as (
  select code_hash as invite_code_hash
  from public.invite_codes
  where display_name = 'player-d0441dd925'
  union
  select invite_code_hash
  from public.player_profiles
  where display_name = 'player-d0441dd925'
),
deleted_comments as (
  update public.comments
  set is_deleted = true,
      deleted_at = now(),
      updated_at = now(),
      content = '此用户数据已清除'
  where invite_code_hash in (select invite_code_hash from target_hash)
  returning id
)
delete from public.ratings
where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.clear_records where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.match_queue where player_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.match_room_players where player_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.match_muster_participants where player_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.match_musters where creator_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.score_messages where player_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.score_change_logs where player_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.score_settlement_entries where player_code_hash in (select invite_code_hash from target_hash);

delete from public.score_settlements s
where not exists (
  select 1 from public.score_settlement_entries e where e.settlement_id = s.id
);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.profile_titles
where invite_code_hash in (select invite_code_hash from target_hash)
   or granted_by_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.profile_curses
where invite_code_hash in (select invite_code_hash from target_hash)
   or granted_by_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.talent_overflow_choices where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.talent_draw_logs where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.talent_exchange_logs where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.owned_talents where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.talent_pool_counters where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.talent_draw_state where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.user_fragments where invite_code_hash in (select invite_code_hash from target_hash);

with target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name = 'player-d0441dd925'
  union select invite_code_hash from public.player_profiles where display_name = 'player-d0441dd925'
)
delete from public.player_profiles where invite_code_hash in (select invite_code_hash from target_hash);

-- Keep the invite row but reset it to an unused placeholder and deactivate it.
-- If you want to reuse this invite code instead, remove "is_active = false".
update public.invite_codes
set display_name = 'cleared-' || left(code_hash, 12),
    is_active = false
where display_name = 'player-d0441dd925';

commit;
*/
