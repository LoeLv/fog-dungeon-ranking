-- Add the limited promo code "名声在外，有好有坏".
-- Run this whole script from the top in Supabase SQL Editor.
-- Window: 2026-08-27 00:00:00 +08 through 2026-08-28 00:00:00 +08.
-- Reward: 20 talent draws.
--   - profiles below 1500 ascension score receive 20 basic draws
--   - profiles at 1500+ ascension score receive 20 advanced draws
-- Promo/event draws are consumed as non-starter draws, so they are included in
-- the talent-pool guarantee counters.

begin;

do $$
begin
  if to_regclass('public.promo_codes') is null then
    raise exception 'Missing public.promo_codes. Run supabase/migrations/promo_code_redemption_20260811.sql first.';
  end if;

  if to_regclass('public.promo_code_redemptions') is null then
    raise exception 'Missing public.promo_code_redemptions. Run supabase/migrations/promo_code_redemption_20260811.sql first.';
  end if;
end
$$;

alter table public.talent_draw_state
  add column if not exists event_basic_draws integer not null default 0 check (event_basic_draws >= 0),
  add column if not exists event_advanced_draws integer not null default 0 check (event_advanced_draws >= 0),
  add column if not exists event_basic_spent_draws integer not null default 0 check (event_basic_spent_draws >= 0),
  add column if not exists event_advanced_spent_draws integer not null default 0 check (event_advanced_spent_draws >= 0);

create or replace function public.redeem_promo_code(
  p_code_text text,
  p_invite_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $redeem$
declare
  v_code_text text := btrim(coalesce(p_code_text, ''));
  v_code public.promo_codes%rowtype;
  v_profile record;
  v_redemption_id bigint;
  v_next_ascension numeric(8, 1);
  v_reward_basic_draws integer;
  v_reward_advanced_draws integer;
  v_tiered_draws integer := 0;
begin
  if char_length(coalesce(p_invite_code_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'login identity is invalid, please enter the invite code again');
  end if;

  if v_code_text = '' then
    return jsonb_build_object('ok', false, 'error', 'please enter a promo code');
  end if;

  select *
  into v_code
  from public.promo_codes
  where code_text = v_code_text
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'promo code does not exist');
  end if;

  if v_code.is_active is not true then
    return jsonb_build_object('ok', false, 'error', 'promo code is closed');
  end if;

  if now() < v_code.starts_at then
    return jsonb_build_object('ok', false, 'error', 'promo code is not open yet');
  end if;

  if now() > v_code.expires_at then
    return jsonb_build_object('ok', false, 'error', 'promo code has expired');
  end if;

  select invite_code_hash, display_name, role, ascension_score
  into v_profile
  from public.player_profiles
  where invite_code_hash = p_invite_code_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'please save your profile before redeeming a promo code');
  end if;

  if v_profile.role not in ('player', 'author', 'reviewer', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'special accounts cannot redeem promo codes');
  end if;

  v_reward_basic_draws := v_code.reward_basic_draws;
  v_reward_advanced_draws := v_code.reward_advanced_draws;

  if v_code.code_text = 'hello world' then
    v_tiered_draws := 15;
  elsif v_code.code_text = U&'\540D\58F0\5728\5916\FF0C\6709\597D\574F' then
    v_tiered_draws := 20;
  end if;

  if v_tiered_draws > 0 then
    if coalesce(v_profile.ascension_score, 1000) >= 1500 then
      v_reward_basic_draws := 0;
      v_reward_advanced_draws := v_tiered_draws;
    else
      v_reward_basic_draws := v_tiered_draws;
      v_reward_advanced_draws := 0;
    end if;
  end if;

  insert into public.promo_code_redemptions (
    promo_code_id,
    invite_code_hash,
    display_name,
    reward_ascension_score,
    reward_basic_draws,
    reward_advanced_draws
  )
  values (
    v_code.id,
    p_invite_code_hash,
    v_profile.display_name,
    v_code.reward_ascension_score,
    v_reward_basic_draws,
    v_reward_advanced_draws
  )
  on conflict (promo_code_id, invite_code_hash) do nothing
  returning id into v_redemption_id;

  if v_redemption_id is null then
    return jsonb_build_object('ok', false, 'error', 'this promo code has already been redeemed');
  end if;

  v_next_ascension := least(
    999999::numeric,
    round((coalesce(v_profile.ascension_score, 1000) + v_code.reward_ascension_score)::numeric, 1)
  )::numeric(8, 1);

  update public.player_profiles
  set ascension_score = v_next_ascension,
      updated_at = now()
  where invite_code_hash = p_invite_code_hash;

  insert into public.talent_draw_state (
    invite_code_hash,
    spent_draws,
    basic_spent_draws,
    advanced_spent_draws,
    event_basic_draws,
    event_advanced_draws,
    event_basic_spent_draws,
    event_advanced_spent_draws,
    updated_at
  )
  values (
    p_invite_code_hash,
    0,
    0,
    0,
    v_reward_basic_draws,
    v_reward_advanced_draws,
    0,
    0,
    now()
  )
  on conflict (invite_code_hash) do update
  set event_basic_draws = public.talent_draw_state.event_basic_draws + excluded.event_basic_draws,
      event_advanced_draws = public.talent_draw_state.event_advanced_draws + excluded.event_advanced_draws,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'promo_code', v_code.code_text,
    'display_name', v_profile.display_name,
    'reward_ascension_score', v_code.reward_ascension_score,
    'reward_basic_draws', v_reward_basic_draws,
    'reward_advanced_draws', v_reward_advanced_draws,
    'new_ascension_score', v_next_ascension,
    'redeemed_at', now()
  );
end
$redeem$;

revoke all on function public.redeem_promo_code(text, text) from public;
grant execute on function public.redeem_promo_code(text, text) to service_role;

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
  U&'\540D\58F0\5728\5916\FF0C\6709\597D\574F',
  0,
  20,
  0,
  timestamptz '2026-08-27 00:00:00+08',
  timestamptz '2026-08-28 00:00:00+08',
  true,
  '2026-08-27 limited promo: 20 draws; below 1500 basic, 1500+ advanced; counts toward pity'
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
where code_text = U&'\540D\58F0\5728\5916\FF0C\6709\597D\574F';
