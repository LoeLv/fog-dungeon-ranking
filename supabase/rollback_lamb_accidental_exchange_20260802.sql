-- Roll back player "羔羊"'s latest accidental 80-fragment talent exchange.
-- SQL Editor-safe version: no temporary tables.
-- Scope:
--   1) Refund exactly the latest talent_exchange_logs row with cost_fragment = 80.
--   2) Remove the exchanged talent if it is still in owned_talents storage or pending overflow.
--   3) Do not touch equipped talents, draw logs, other owned talents, or other players.

-- Clears any failed transaction state from a previous run. It is harmless if no transaction is open.
rollback;

-- Preview the exact exchange row that the guarded rollback will target.
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

do $$
declare
  v_identity_count integer;
  v_invite_code_hash text;
  v_exchange_log_id bigint;
  v_pool_key text;
  v_target_talent_id integer;
  v_target_talent_name text;
  v_cost_fragment integer;
  v_exchange_time timestamptz;
  v_owned_talent_id bigint;
  v_overflow_choice_id bigint;
begin
  with target_identity as (
    select invite_code_hash, display_name from public.player_profiles where display_name = '羔羊'
    union
    select code_hash as invite_code_hash, display_name from public.invite_codes where display_name = '羔羊' and is_active = true
  )
  select count(*), min(invite_code_hash)
  into v_identity_count, v_invite_code_hash
  from target_identity;

  if v_identity_count <> 1 then
    raise exception 'Expected exactly one active/profile identity for 羔羊, found %', v_identity_count;
  end if;

  select
    e.id,
    e.pool_key,
    e.target_talent_id,
    e.target_talent_name,
    e.cost_fragment,
    e.exchange_time
  into
    v_exchange_log_id,
    v_pool_key,
    v_target_talent_id,
    v_target_talent_name,
    v_cost_fragment,
    v_exchange_time
  from public.talent_exchange_logs e
  where e.invite_code_hash = v_invite_code_hash
    and e.cost_fragment = 80
  order by e.exchange_time desc, e.id desc
  limit 1;

  if v_exchange_log_id is null then
    raise exception 'No 80-fragment exchange log found for 羔羊';
  end if;

  select o.id
  into v_owned_talent_id
  from public.owned_talents o
  where o.invite_code_hash = v_invite_code_hash
    and o.pool_key = v_pool_key
    and o.talent_id = v_target_talent_id
    and o.acquired_from = 'exchange'
    and o.storage_slot is not null
    and o.equipped_slot is null
  order by abs(extract(epoch from (o.acquired_at - v_exchange_time))) asc, o.id desc
  limit 1;

  select c.id
  into v_overflow_choice_id
  from public.talent_overflow_choices c
  where c.invite_code_hash = v_invite_code_hash
    and c.pool_key = v_pool_key
    and c.talent_id = v_target_talent_id
    and c.source = 'exchange'
  order by abs(extract(epoch from (c.created_at - v_exchange_time))) asc, c.id desc
  limit 1;

  if ((v_owned_talent_id is not null)::int + (v_overflow_choice_id is not null)::int) <> 1 then
    raise exception 'Rollback guard failed for %: exchanged talent must exist in exactly one place, owned storage or pending overflow', v_target_talent_name;
  end if;

  insert into public.user_fragments (invite_code_hash, fragment_total, updated_at)
  values (v_invite_code_hash, v_cost_fragment, now())
  on conflict (invite_code_hash) do update
  set fragment_total = public.user_fragments.fragment_total + excluded.fragment_total,
      updated_at = now();

  if v_owned_talent_id is not null then
    delete from public.owned_talents owned
    where owned.id = v_owned_talent_id
      and owned.invite_code_hash = v_invite_code_hash
      and owned.acquired_from = 'exchange'
      and owned.storage_slot is not null
      and owned.equipped_slot is null;
  end if;

  if v_overflow_choice_id is not null then
    delete from public.talent_overflow_choices overflow
    where overflow.id = v_overflow_choice_id
      and overflow.invite_code_hash = v_invite_code_hash
      and overflow.source = 'exchange';
  end if;

  delete from public.talent_exchange_logs log
  where log.id = v_exchange_log_id
    and log.invite_code_hash = v_invite_code_hash;

  raise notice 'Rolled back 羔羊 exchange log %, talent % %, refunded % fragments',
    v_exchange_log_id, v_pool_key, v_target_talent_id, v_cost_fragment;
end $$;

-- Verification: fragment total should be +80 versus before this rollback.
-- The previewed exchange_log_id should no longer exist.
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
