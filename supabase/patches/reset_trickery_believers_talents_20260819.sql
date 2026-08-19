-- Reset all talent state for believers of 欺诈.
-- Scope:
--   - clears all owned talents, overflow choices, S choices, draw logs,
--     exchange logs, and pool counters for current 欺诈 believers;
--   - refunds every spent draw by resetting draw-state spent counters;
--   - preserves faith, profession, ascension score, audience score, and fragments.
-- Run the whole script from the top in Supabase SQL Editor.

-- Preview the exact accounts and talent state that will be affected.
select
  p.display_name,
  p.invite_code_hash,
  coalesce((select count(*) from public.owned_talents o
    where o.invite_code_hash = p.invite_code_hash), 0) as owned_talents,
  coalesce((select count(*) from public.talent_overflow_choices c
    where c.invite_code_hash = p.invite_code_hash), 0) as overflow_choices,
  coalesce((select count(*) from public.talent_draw_logs l
    where l.invite_code_hash = p.invite_code_hash), 0) as draw_logs,
  coalesce((select count(*) from public.talent_exchange_logs e
    where e.invite_code_hash = p.invite_code_hash), 0) as exchange_logs,
  coalesce(s.spent_draws, 0) as spent_draws,
  coalesce(s.basic_spent_draws, 0) as basic_spent_draws,
  coalesce(s.advanced_spent_draws, 0) as advanced_spent_draws,
  coalesce(s.event_basic_spent_draws, 0) as event_basic_spent_draws,
  coalesce(s.event_advanced_spent_draws, 0) as event_advanced_spent_draws,
  coalesce(f.fragment_total, 0) as fragments_preserved
from public.player_profiles p
left join public.talent_draw_state s on s.invite_code_hash = p.invite_code_hash
left join public.user_fragments f on f.invite_code_hash = p.invite_code_hash
where p.faith_god = '欺诈'
   or p.original_faith_god = '欺诈'
order by p.display_name;

begin;

-- Remove all talent ownership and pending choices for the target accounts.
delete from public.owned_talents o
using public.player_profiles p
where o.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

delete from public.talent_overflow_choices c
using public.player_profiles p
where c.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

delete from public.talent_s_choices c
using public.player_profiles p
where c.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

-- Remove historical talent records so they cannot rebuild old counters.
delete from public.talent_draw_logs l
using public.player_profiles p
where l.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

delete from public.talent_exchange_logs l
using public.player_profiles p
where l.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

delete from public.talent_pool_counters c
using public.player_profiles p
where c.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

-- Reset spent draws only. Earned draws remain derived from scores and grants.
update public.talent_draw_state s
set
  spent_draws = 0,
  basic_spent_draws = 0,
  advanced_spent_draws = 0,
  event_basic_spent_draws = 0,
  event_advanced_spent_draws = 0,
  updated_at = now()
from public.player_profiles p
where s.invite_code_hash = p.invite_code_hash
  and (p.faith_god = '欺诈' or p.original_faith_god = '欺诈');

update public.player_profiles p
set
  talents = '',
  updated_at = now()
where p.faith_god = '欺诈'
   or p.original_faith_god = '欺诈';

commit;

-- Verify that talent state is empty and scores/fragments were not modified here.
select
  p.display_name,
  coalesce((select count(*) from public.owned_talents o
    where o.invite_code_hash = p.invite_code_hash), 0) as owned_talents_remaining,
  coalesce((select count(*) from public.talent_overflow_choices c
    where c.invite_code_hash = p.invite_code_hash), 0) as overflow_remaining,
  coalesce((select count(*) from public.talent_s_choices c
    where c.invite_code_hash = p.invite_code_hash), 0) as s_choices_remaining,
  coalesce(s.spent_draws, 0) as spent_draws_remaining,
  coalesce(s.basic_spent_draws, 0) as basic_spent_draws_remaining,
  coalesce(s.advanced_spent_draws, 0) as advanced_spent_draws_remaining,
  p.ascension_score,
  p.audience_score,
  coalesce(f.fragment_total, 0) as fragments_preserved
from public.player_profiles p
left join public.talent_draw_state s on s.invite_code_hash = p.invite_code_hash
left join public.user_fragments f on f.invite_code_hash = p.invite_code_hash
where p.faith_god = '欺诈'
   or p.original_faith_god = '欺诈'
order by p.display_name;
