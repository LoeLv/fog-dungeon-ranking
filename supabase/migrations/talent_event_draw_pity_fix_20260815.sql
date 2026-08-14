-- Fix event and promo-code talent draws being mistaken for starter draws.
-- Run this whole script from the top in Supabase SQL Editor.
-- Event draws count toward pity; the 15 starter draws remain excluded.

begin;

alter table public.talent_draw_state
  add column if not exists event_basic_spent_draws integer not null default 0
    check (event_basic_spent_draws >= 0),
  add column if not exists event_advanced_spent_draws integer not null default 0
    check (event_advanced_spent_draws >= 0);

-- Existing grants were stored in the same balance as starter draws. Treat
-- already-spent event draws as consumed first so the current state matches the
-- new deterministic draw order and immediately restores their pity progress.
update public.talent_draw_state
set
  event_basic_spent_draws = least(
    greatest(coalesce(event_basic_draws, 0), 0),
    greatest(
      coalesce(basic_spent_draws, 0),
      coalesce(spent_draws, 0) - coalesce(advanced_spent_draws, 0),
      0
    )
  ),
  event_advanced_spent_draws = least(
    greatest(coalesce(event_advanced_draws, 0), 0),
    greatest(coalesce(advanced_spent_draws, 0), 0)
  ),
  updated_at = now();

commit;

select
  invite_code_hash,
  basic_spent_draws,
  event_basic_draws,
  event_basic_spent_draws,
  advanced_spent_draws,
  event_advanced_draws,
  event_advanced_spent_draws,
  updated_at
from public.talent_draw_state
order by updated_at desc
limit 30;
