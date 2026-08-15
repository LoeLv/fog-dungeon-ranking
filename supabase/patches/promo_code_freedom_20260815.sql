-- Limited promo code for 2026-08-15.
-- Run this whole script from the top in Supabase SQL Editor.
-- Code: Freedom or not for yourself
-- Reward: 10 basic talent draws. Each account can redeem once.

begin;

insert into public.promo_codes (
  code_text,
  reward_ascension_score,
  reward_basic_draws,
  reward_advanced_draws,
  starts_at,
  expires_at,
  is_active,
  note
)
values (
  'Freedom or not for yourself',
  0,
  10,
  0,
  timestamptz '2026-08-15 00:00:00+08',
  timestamptz '2026-08-15 23:59:59+08',
  true,
  '2026-08-15 limited code: 10 basic talent draws'
)
on conflict (code_text) do update
set reward_ascension_score = excluded.reward_ascension_score,
    reward_basic_draws = excluded.reward_basic_draws,
    reward_advanced_draws = excluded.reward_advanced_draws,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    is_active = true,
    note = excluded.note,
    updated_at = now();

commit;

select
  code_text,
  reward_ascension_score,
  reward_basic_draws,
  reward_advanced_draws,
  starts_at,
  expires_at,
  is_active,
  note
from public.promo_codes
where code_text = 'Freedom or not for yourself';
