-- Split talent draws by the 1500 ascension-score threshold.
-- Basic draws (earned before 1500) always remain B/C draws.

begin;

alter table public.talent_draw_state
  add column if not exists basic_spent_draws integer not null default 0
    check (basic_spent_draws >= 0),
  add column if not exists advanced_spent_draws integer not null default 0
    check (advanced_spent_draws >= 0);

-- Before 1500, a player earns 15 starter draws plus 49 score draws: 64 basic draws.
-- Old records have no per-draw tier history, so this conservative split prevents
-- old unused draws from becoming A/S draws after the upgrade.
update public.talent_draw_state
set
  basic_spent_draws = least(spent_draws, 64),
  advanced_spent_draws = greatest(spent_draws - 64, 0)
where basic_spent_draws = 0
  and advanced_spent_draws = 0
  and spent_draws > 0;

commit;

-- Verification
select invite_code_hash, spent_draws, basic_spent_draws, advanced_spent_draws
from public.talent_draw_state
order by updated_at desc
limit 30;
