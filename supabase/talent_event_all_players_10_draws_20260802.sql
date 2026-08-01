-- 2026-08-02 talent event: 庆祝腐朽登神活动.
-- Grant every active playable invite code 10 event draws.
-- Players below 1500 ascension score receive basic B/C draws.
-- Players at 1500+ ascension score receive advanced S/A/B/C draws.
-- Idempotent: running this file again keeps this event grant at 10, it does not add another 10.

begin;

alter table public.talent_draw_state
  add column if not exists basic_spent_draws integer not null default 0
    check (basic_spent_draws >= 0),
  add column if not exists advanced_spent_draws integer not null default 0
    check (advanced_spent_draws >= 0),
  add column if not exists event_basic_draws integer not null default 0
    check (event_basic_draws >= 0),
  add column if not exists event_advanced_draws integer not null default 0
    check (event_advanced_draws >= 0);

with eligible_invites as (
  select
    i.code_hash,
    i.display_name,
    i.role,
    coalesce(p.ascension_score, 1000) as ascension_score,
    coalesce(p.ascension_score, 1000) >= 1500 as gets_advanced_event_draws
  from public.invite_codes i
  left join public.player_profiles p on p.invite_code_hash = i.code_hash
  where i.is_active = true
    and i.role in ('player', 'author', 'reviewer', 'admin', 'god')
),
granted as (
  insert into public.talent_draw_state (
    invite_code_hash,
    spent_draws,
    basic_spent_draws,
    advanced_spent_draws,
    event_basic_draws,
    event_advanced_draws,
    updated_at
  )
  select
    code_hash,
    0,
    0,
    0,
    case when gets_advanced_event_draws then 0 else 10 end,
    case when gets_advanced_event_draws then 10 else 0 end,
    now()
  from eligible_invites
  on conflict (invite_code_hash) do update
  set event_basic_draws = case
        when excluded.event_basic_draws > 0 then greatest(public.talent_draw_state.event_basic_draws, excluded.event_basic_draws)
        else public.talent_draw_state.event_basic_draws
      end,
      event_advanced_draws = case
        when excluded.event_advanced_draws > 0 then greatest(public.talent_draw_state.event_advanced_draws, excluded.event_advanced_draws)
        else public.talent_draw_state.event_advanced_draws
      end,
      updated_at = now()
  where
    (excluded.event_basic_draws > 0 and public.talent_draw_state.event_basic_draws < excluded.event_basic_draws)
    or (excluded.event_advanced_draws > 0 and public.talent_draw_state.event_advanced_draws < excluded.event_advanced_draws)
  returning invite_code_hash, event_basic_draws, event_advanced_draws
)
select
  (select count(*) from eligible_invites) as active_eligible_invites,
  count(*) as inserted_or_updated_rows,
  count(*) filter (where event_basic_draws >= 10) as basic_event_rows_written,
  count(*) filter (where event_advanced_draws >= 10) as advanced_event_rows_written
from granted;

commit;

-- Verification 1: active playable invite codes that still have not received the event grant.
select
  i.display_name,
  i.role,
  coalesce(p.ascension_score, 1000) as ascension_score,
  case when coalesce(p.ascension_score, 1000) >= 1500 then 'advanced S/A/B/C' else 'basic B/C' end as expected_event_draw_tier,
  coalesce(ds.event_basic_draws, 0) as event_basic_draws,
  coalesce(ds.event_advanced_draws, 0) as event_advanced_draws
from public.invite_codes i
left join public.player_profiles p on p.invite_code_hash = i.code_hash
left join public.talent_draw_state ds on ds.invite_code_hash = i.code_hash
where i.is_active = true
  and i.role in ('player', 'author', 'reviewer', 'admin', 'god')
  and (
    (coalesce(p.ascension_score, 1000) < 1500 and coalesce(ds.event_basic_draws, 0) < 10)
    or (coalesce(p.ascension_score, 1000) >= 1500 and coalesce(ds.event_advanced_draws, 0) < 10)
  )
order by i.role, i.display_name;

-- Verification 2: current event grant coverage by role.
select
  i.role,
  count(*) as active_invites,
  count(*) filter (where coalesce(p.ascension_score, 1000) < 1500) as expected_basic_invites,
  count(*) filter (where coalesce(p.ascension_score, 1000) >= 1500) as expected_advanced_invites,
  count(*) filter (where coalesce(ds.event_basic_draws, 0) >= 10) as basic_granted_invites,
  count(*) filter (where coalesce(ds.event_advanced_draws, 0) >= 10) as advanced_granted_invites
from public.invite_codes i
left join public.player_profiles p on p.invite_code_hash = i.code_hash
left join public.talent_draw_state ds on ds.invite_code_hash = i.code_hash
where i.is_active = true
  and i.role in ('player', 'author', 'reviewer', 'admin', 'god')
group by i.role
order by i.role;
