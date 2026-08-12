-- Production user-data reset for official launch.
-- Destructive: clears beta/test/user-created data and revokes existing invite codes.
-- Run in Supabase SQL Editor after confirming you have exported anything you still need.
-- This intentionally keeps schema, RLS/policies, functions, and talent_pool_items.

begin;

-- Clear user identity, invite, score, talent, matching, discussion, rating, clear, and dungeon data.
-- Order is explicit so this can run even when foreign keys are restrictive.
truncate table
  public.score_messages,
  public.score_change_logs,
  public.score_settlement_entries,
  public.score_settlements,
  public.talent_overflow_choices,
  public.talent_exchange_logs,
  public.talent_draw_logs,
  public.user_fragments,
  public.owned_talents,
  public.talent_pool_counters,
  public.talent_draw_state,
  public.match_muster_participants,
  public.match_musters,
  public.match_room_players,
  public.match_queue,
  public.match_rooms,
  public.ratings,
  public.comments,
  public.clear_records,
  public.dungeons,
  public.player_profiles,
  public.invite_codes
restart identity cascade;

-- Reset denormalized dungeon counters defensively if seed dungeons are imported before this script.
update public.dungeons
set
  avg_rating = 0,
  rating_count = 0,
  comment_count = 0,
  run_count = greatest(coalesce(run_count, 1), 1),
  clear_count = 0,
  clear_rate = 0;

commit;

select 'invite_codes' as table_name, count(*) as row_count from public.invite_codes
union all select 'dungeons', count(*) from public.dungeons
union all select 'comments', count(*) from public.comments
union all select 'ratings', count(*) from public.ratings
union all select 'clear_records', count(*) from public.clear_records
union all select 'player_profiles', count(*) from public.player_profiles
union all select 'score_settlements', count(*) from public.score_settlements
union all select 'score_messages', count(*) from public.score_messages
union all select 'owned_talents', count(*) from public.owned_talents
union all select 'talent_draw_state', count(*) from public.talent_draw_state
union all select 'talent_draw_logs', count(*) from public.talent_draw_logs
union all select 'user_fragments', count(*) from public.user_fragments
union all select 'talent_overflow_choices', count(*) from public.talent_overflow_choices
union all select 'match_queue', count(*) from public.match_queue
union all select 'match_rooms', count(*) from public.match_rooms
union all select 'match_room_players', count(*) from public.match_room_players
union all select 'match_musters', count(*) from public.match_musters
union all select 'match_muster_participants', count(*) from public.match_muster_participants
union all select 'talent_pool_items_kept', count(*) from public.talent_pool_items
order by table_name;
