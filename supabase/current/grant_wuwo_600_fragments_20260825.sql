-- Grant 600 exchange fragments to the account displayed as 无我.
-- Run the preview first; run the transaction only after the target row is correct.

-- 1) Preview target. This should return exactly one row for 无我.
select
  p.invite_code_hash,
  p.display_name,
  p.role,
  coalesce(f.fragment_total, 0) as fragment_total_before
from public.player_profiles p
left join public.user_fragments f
  on f.invite_code_hash = p.invite_code_hash
where p.display_name = '无我'
order by p.updated_at desc;

-- 2) Grant fragments.
begin;

do $$
declare
  target_hash text;
  target_count integer;
begin
  select count(*)
    into target_count
  from public.player_profiles
  where display_name = '无我';

  if target_count <> 1 then
    raise exception 'Expected exactly one player_profiles row for 无我, found %', target_count;
  end if;

  select invite_code_hash
    into target_hash
  from public.player_profiles
  where display_name = '无我'
  order by updated_at desc
  limit 1;

  insert into public.user_fragments (invite_code_hash, fragment_total, updated_at)
  values (target_hash, 600, now())
  on conflict (invite_code_hash) do update
  set fragment_total = public.user_fragments.fragment_total + 600,
      updated_at = now();
end $$;

commit;

-- 3) Verify result.
select
  p.invite_code_hash,
  p.display_name,
  p.role,
  coalesce(f.fragment_total, 0) as fragment_total_after
from public.player_profiles p
left join public.user_fragments f
  on f.invite_code_hash = p.invite_code_hash
where p.display_name = '无我'
order by p.updated_at desc;
