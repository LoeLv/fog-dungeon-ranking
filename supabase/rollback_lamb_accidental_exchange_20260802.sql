-- Roll back player "羔羊"'s latest accidental 80-fragment talent exchange.
-- Scope:
--   1) Refund exactly the latest talent_exchange_logs row with cost_fragment = 80.
--   2) Remove the exchanged talent if it is still in owned_talents storage or pending overflow.
--   3) Do not touch equipped talents, draw logs, other owned talents, or other players.

-- Preview the exact row before the guarded rollback below.
with target_identity as (
  select invite_code_hash, display_name from public.player_profiles where display_name = '羔羊'
  union
  select code_hash as invite_code_hash, display_name from public.invite_codes where display_name = '羔羊' and is_active = true
),
latest_exchange as (
  select e.*
  from public.talent_exchange_logs e
  join target_identity t on t.invite_code_hash = e.invite_code_hash
  where e.cost_fragment = 80
  order by e.exchange_time desc, e.id desc
  limit 1
)
select
  t.display_name,
  e.id as exchange_log_id,
  e.pool_key,
  e.target_talent_id,
  e.target_talent_name,
  e.cost_fragment,
  e.exchange_time
from latest_exchange e
join target_identity t on t.invite_code_hash = e.invite_code_hash;

begin;

create temp table _lamb_target_identity on commit drop as
select distinct invite_code_hash, display_name
from (
  select invite_code_hash, display_name from public.player_profiles where display_name = '羔羊'
  union
  select code_hash as invite_code_hash, display_name from public.invite_codes where display_name = '羔羊' and is_active = true
) target;

do $$
begin
  if (select count(*) from _lamb_target_identity) <> 1 then
    raise exception 'Expected exactly one active/profile identity for 羔羊, found %', (select count(*) from _lamb_target_identity);
  end if;
end $$;

create temp table _lamb_exchange_rollback on commit drop as
with latest_exchange as (
  select e.*
  from public.talent_exchange_logs e
  join _lamb_target_identity t on t.invite_code_hash = e.invite_code_hash
  where e.cost_fragment = 80
  order by e.exchange_time desc, e.id desc
  limit 1
)
select
  t.invite_code_hash,
  t.display_name,
  e.id as exchange_log_id,
  e.pool_key,
  e.target_talent_id,
  e.target_talent_name,
  e.cost_fragment,
  e.exchange_time,
  owned_match.id as owned_talent_id,
  overflow_match.id as overflow_choice_id
from latest_exchange e
join _lamb_target_identity t on t.invite_code_hash = e.invite_code_hash
left join lateral (
  select o.id
  from public.owned_talents o
  where o.invite_code_hash = e.invite_code_hash
    and o.pool_key = e.pool_key
    and o.talent_id = e.target_talent_id
    and o.acquired_from = 'exchange'
    and o.storage_slot is not null
    and o.equipped_slot is null
  order by abs(extract(epoch from (o.acquired_at - e.exchange_time))) asc, o.id desc
  limit 1
) owned_match on true
left join lateral (
  select c.id
  from public.talent_overflow_choices c
  where c.invite_code_hash = e.invite_code_hash
    and c.pool_key = e.pool_key
    and c.talent_id = e.target_talent_id
    and c.source = 'exchange'
  order by abs(extract(epoch from (c.created_at - e.exchange_time))) asc, c.id desc
  limit 1
) overflow_match on true;

do $$
begin
  if (select count(*) from _lamb_exchange_rollback) <> 1 then
    raise exception 'Expected exactly one latest 80-fragment exchange row for 羔羊, found %', (select count(*) from _lamb_exchange_rollback);
  end if;

  if exists (
    select 1
    from _lamb_exchange_rollback
    where ((owned_talent_id is not null)::int + (overflow_choice_id is not null)::int) <> 1
  ) then
    raise exception 'Rollback guard failed: exchanged talent must exist in exactly one place: owned storage or pending overflow';
  end if;
end $$;

insert into public.user_fragments (invite_code_hash, fragment_total, updated_at)
select invite_code_hash, cost_fragment, now()
from _lamb_exchange_rollback
on conflict (invite_code_hash) do update
set fragment_total = public.user_fragments.fragment_total + excluded.fragment_total,
    updated_at = now();

delete from public.owned_talents owned
using _lamb_exchange_rollback r
where owned.id = r.owned_talent_id
  and owned.invite_code_hash = r.invite_code_hash
  and owned.acquired_from = 'exchange'
  and owned.storage_slot is not null
  and owned.equipped_slot is null;

delete from public.talent_overflow_choices overflow
using _lamb_exchange_rollback r
where overflow.id = r.overflow_choice_id
  and overflow.invite_code_hash = r.invite_code_hash
  and overflow.source = 'exchange';

delete from public.talent_exchange_logs log
using _lamb_exchange_rollback r
where log.id = r.exchange_log_id
  and log.invite_code_hash = r.invite_code_hash;

commit;

-- Verification: fragment total should be +80 versus before this rollback,
-- and the exchange_log_id from the preview should no longer exist.
with target_identity as (
  select invite_code_hash, display_name from public.player_profiles where display_name = '羔羊'
  union
  select code_hash as invite_code_hash, display_name from public.invite_codes where display_name = '羔羊' and is_active = true
)
select
  t.display_name,
  f.fragment_total,
  (
    select count(*)
    from public.talent_exchange_logs e
    where e.invite_code_hash = t.invite_code_hash
      and e.cost_fragment = 80
  ) as remaining_80_fragment_exchange_logs
from target_identity t
left join public.user_fragments f on f.invite_code_hash = t.invite_code_hash;
