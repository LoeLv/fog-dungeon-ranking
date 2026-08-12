-- User data purge template.
-- Replace the value in target_user.display_name, then run the preview first.
-- This keeps authored dungeons themselves, to avoid deleting public dungeon content and other users' comments/ratings.

-- 1) Preview target identity and affected row counts.
with target_user(display_name) as (
  values ('REPLACE_WITH_DISPLAY_NAME')
),
target as (
  select i.code_hash as invite_code_hash, i.display_name, i.role, 'invite_codes' as source
  from public.invite_codes i
  join target_user u on i.display_name = u.display_name
  union
  select p.invite_code_hash, p.display_name, p.role, 'player_profiles' as source
  from public.player_profiles p
  join target_user u on p.display_name = u.display_name
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

-- 2) Transaction purge.
-- Run only after previewing the target.
begin;

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
update public.comments
set is_deleted = true,
    deleted_at = now(),
    updated_at = now(),
    content = '此用户数据已清除'
where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.ratings where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.clear_records where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.match_queue where player_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.match_room_players where player_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.match_muster_participants where player_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.match_musters where creator_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.score_messages where player_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.score_change_logs where player_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
),
affected_settlements as (
  select distinct settlement_id
  from public.score_settlement_entries
  where player_code_hash in (select invite_code_hash from target_hash)
    and settlement_id is not null
),
deleted_entries as (
  delete from public.score_settlement_entries
  where player_code_hash in (select invite_code_hash from target_hash)
  returning settlement_id
)
delete from public.score_settlements s
where s.id in (select settlement_id from affected_settlements)
  and not exists (
    select 1 from public.score_settlement_entries e where e.settlement_id = s.id
  );

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.profile_titles
where invite_code_hash in (select invite_code_hash from target_hash)
   or granted_by_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.profile_curses
where invite_code_hash in (select invite_code_hash from target_hash)
   or granted_by_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.talent_overflow_choices where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.talent_draw_logs where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.talent_exchange_logs where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.owned_talents where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.talent_pool_counters where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.talent_draw_state where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.user_fragments where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME')),
target_hash as (
  select code_hash as invite_code_hash from public.invite_codes where display_name in (select display_name from target_user)
  union select invite_code_hash from public.player_profiles where display_name in (select display_name from target_user)
)
delete from public.player_profiles where invite_code_hash in (select invite_code_hash from target_hash);

with target_user(display_name) as (values ('REPLACE_WITH_DISPLAY_NAME'))
update public.invite_codes
set display_name = 'cleared-' || left(code_hash, 12),
    is_active = false
where display_name in (select display_name from target_user);

commit;
