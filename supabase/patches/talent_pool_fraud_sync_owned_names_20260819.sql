-- Sync persisted fraud-pool talent names and ranks from the canonical pool rows.
-- This fixes historical records where the talent id was correct but the stored
-- name/rank came from an older or mismatched definition.
-- Does not delete talents, refund draws, change fragments, or change counters.
-- Run the whole script from the top in Supabase SQL Editor.

select
  o.invite_code_hash,
  o.id,
  o.talent_id,
  o.talent_name as stored_talent_name,
  p.talent_name as canonical_talent_name,
  o.rank as stored_rank,
  p.rank as canonical_rank
from public.owned_talents o
join public.talent_pool_items p
  on p.pool_key = o.pool_key
 and p.talent_id = o.talent_id
where o.pool_key = 'Pool欺诈'
  and (o.talent_name is distinct from p.talent_name or o.rank is distinct from p.rank)
order by o.invite_code_hash, o.storage_slot nulls last, o.id;

begin;

update public.owned_talents o
set
  talent_name = p.talent_name,
  rank = p.rank
from public.talent_pool_items p
where o.pool_key = 'Pool欺诈'
  and p.pool_key = o.pool_key
  and p.talent_id = o.talent_id
  and (o.talent_name is distinct from p.talent_name or o.rank is distinct from p.rank);

update public.talent_overflow_choices o
set
  talent_name = p.talent_name,
  rank = p.rank
from public.talent_pool_items p
where o.pool_key = 'Pool欺诈'
  and p.pool_key = o.pool_key
  and p.talent_id = o.talent_id
  and (o.talent_name is distinct from p.talent_name or o.rank is distinct from p.rank);

update public.talent_draw_logs l
set
  talent_name = p.talent_name,
  rank = p.rank
from public.talent_pool_items p
where l.pool_key = 'Pool欺诈'
  and p.pool_key = l.pool_key
  and p.talent_id = l.talent_id
  and (l.talent_name is distinct from p.talent_name or l.rank is distinct from p.rank);

update public.talent_exchange_logs l
set target_talent_name = p.talent_name
from public.talent_pool_items p
where l.pool_key = 'Pool欺诈'
  and p.pool_key = l.pool_key
  and p.talent_id = l.target_talent_id
  and l.target_talent_name is distinct from p.talent_name;

commit;

select
  'owned_talents' as source,
  count(*) as remaining_mismatches
from public.owned_talents o
join public.talent_pool_items p
  on p.pool_key = o.pool_key
 and p.talent_id = o.talent_id
where o.pool_key = 'Pool欺诈'
  and (o.talent_name is distinct from p.talent_name or o.rank is distinct from p.rank)
union all
select
  'talent_overflow_choices',
  count(*)
from public.talent_overflow_choices o
join public.talent_pool_items p
  on p.pool_key = o.pool_key
 and p.talent_id = o.talent_id
where o.pool_key = 'Pool欺诈'
  and (o.talent_name is distinct from p.talent_name or o.rank is distinct from p.rank)
union all
select
  'talent_draw_logs',
  count(*)
from public.talent_draw_logs l
join public.talent_pool_items p
  on p.pool_key = l.pool_key
 and p.talent_id = l.talent_id
where l.pool_key = 'Pool欺诈'
  and (l.talent_name is distinct from p.talent_name or l.rank is distinct from p.rank)
union all
select
  'talent_exchange_logs',
  count(*)
from public.talent_exchange_logs l
join public.talent_pool_items p
  on p.pool_key = l.pool_key
 and p.target_talent_id = l.target_talent_id
where l.pool_key = 'Pool欺诈'
  and l.target_talent_name is distinct from p.talent_name;
