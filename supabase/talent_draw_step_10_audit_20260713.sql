-- Read-only audit after changing talent draw gain from 5 score per draw to 10 score per draw.
-- This does not modify data.

select
  p.display_name,
  p.ascension_score,
  coalesce(ds.spent_draws, 0) as spent_draws,
  15 + greatest(0, floor((p.ascension_score - 1000) / 5)) as old_earned_draws,
  15 + greatest(0, floor((p.ascension_score - 1000) / 10)) as new_earned_draws,
  greatest(0, coalesce(ds.spent_draws, 0) - (15 + greatest(0, floor((p.ascension_score - 1000) / 10)))) as overspent_draws
from public.player_profiles p
left join public.talent_draw_state ds on ds.invite_code_hash = p.invite_code_hash
where coalesce(ds.spent_draws, 0) > (15 + greatest(0, floor((p.ascension_score - 1000) / 10)))
order by overspent_draws desc, p.display_name;
