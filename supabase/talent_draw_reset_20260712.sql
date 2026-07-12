-- Fully reset player talent progress for the 15-draw starter grant.
-- This keeps talent_pool_items and player profile identity/scores intact.

begin;

delete from public.talent_overflow_choices;
delete from public.talent_exchange_logs;
delete from public.talent_draw_logs;
delete from public.owned_talents;
delete from public.user_fragments;

update public.talent_draw_state
set spent_draws = 0,
    updated_at = now();

update public.talent_pool_counters
set continue_draw = 0,
    updated_at = now();

update public.player_profiles
set talents = '',
    updated_at = now()
where talents <> '';

commit;
