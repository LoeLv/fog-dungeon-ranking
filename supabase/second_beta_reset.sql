-- Second beta reset.
-- Destructive: revokes old invite codes and clears beta test data.
-- Run in Supabase SQL Editor only when you are ready to start beta 2.
-- Plain invite codes are intentionally NOT stored in this public repo.

begin;

alter table public.dungeons add column if not exists pinned_note text not null default '';
alter table public.comments add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists is_deleted boolean not null default false;
alter table public.comments add column if not exists deleted_at timestamptz;
alter table public.comments add column if not exists updated_at timestamptz;
alter table public.clear_records add column if not exists feedback_tags text[] not null default '{}'::text[];
alter table public.clear_records add column if not exists feedback_note text;

create table if not exists public.player_profiles (
  invite_code_hash text primary key check (char_length(invite_code_hash) = 64),
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  role text not null check (role in ('player', 'author', 'reviewer', 'admin')),
  faith_god text not null check (char_length(trim(faith_god)) between 1 and 20),
  faith_path text not null check (char_length(trim(faith_path)) between 1 and 20),
  profession text not null check (char_length(trim(profession)) between 1 and 40),
  ascension_score numeric(8, 1) not null default 1000 check (ascension_score >= 0 and ascension_score <= 999999),
  audience_score numeric(8, 1) not null default 0 check (audience_score >= 0 and audience_score <= 999999),
  items text not null default '',
  talents text not null default '',
  scores_locked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists player_profiles_ascension_idx
on public.player_profiles (ascension_score desc, audience_score desc, updated_at desc);

create index if not exists player_profiles_audience_idx
on public.player_profiles (audience_score desc, ascension_score desc, updated_at desc);

create index if not exists player_profiles_path_idx
on public.player_profiles (faith_path, ascension_score desc, audience_score desc);

alter table public.player_profiles enable row level security;

create index if not exists comments_parent_comment_id_idx on public.comments(parent_comment_id, created_at);
create index if not exists comments_latest_active_idx on public.comments(created_at desc) where is_deleted = false;
create index if not exists clear_records_feedback_tags_idx on public.clear_records using gin(feedback_tags);

create or replace view public.clear_feedback_summary as
select
  cr.dungeon_id,
  tag.value as tag,
  count(*)::integer as tag_count
from public.clear_records cr
cross join lateral unnest(coalesce(cr.feedback_tags, '{}'::text[])) as tag(value)
where trim(tag.value) <> ''
group by cr.dungeon_id, tag.value;

create or replace function public.recalculate_dungeon_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_dungeon_id uuid;
begin
  target_dungeon_id := coalesce(new.dungeon_id, old.dungeon_id);

  update public.dungeons
  set
    avg_rating = coalesce(
      (select round(avg(rating)::numeric, 1) from public.ratings where dungeon_id = target_dungeon_id),
      0
    ),
    rating_count = (
      select count(*)::integer from public.ratings where dungeon_id = target_dungeon_id
    )
  where id = target_dungeon_id;

  return coalesce(new, old);
end;
$$;

create or replace function public.recalculate_dungeon_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_dungeon_id uuid;
begin
  target_dungeon_id := coalesce(new.dungeon_id, old.dungeon_id);

  update public.dungeons
  set comment_count = (
    select count(*)::integer
    from public.comments
    where dungeon_id = target_dungeon_id
      and is_deleted = false
  )
  where id = target_dungeon_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists ratings_recalculate_dungeon on public.ratings;
create trigger ratings_recalculate_dungeon
after insert or update or delete on public.ratings
for each row execute function public.recalculate_dungeon_rating();

drop trigger if exists comments_recalculate_dungeon on public.comments;
create trigger comments_recalculate_dungeon
after insert or update or delete on public.comments
for each row execute function public.recalculate_dungeon_comments();

update public.invite_codes
set
  is_active = false,
  note = concat_ws(' | ', nullif(note, ''), 'revoked before second beta')
where is_active = true;

truncate table
  public.ratings,
  public.comments,
  public.clear_records,
  public.dungeons,
  public.player_profiles
restart identity cascade;

alter table public.player_profiles alter column ascension_score set default 1000;
alter table public.player_profiles alter column audience_score set default 0;

insert into public.invite_codes (code_hash, display_name, role, is_active, note)
values
  ('be6c83dbb44bc8dd00e203476007bb06456394e980d0a04a1c1e5741f436d51a', '二测馆主01', 'admin', true, 'second beta full-permission test account'),
  ('7cfa5a0c1ec8a2df75b680df59e218d520ae496498450e055bf2fb0917d46dd3', '二测馆主02', 'admin', true, 'second beta full-permission test account'),
  ('51ffe96b9e74c61170fc304760b7271c414f8b4b70d3eece26b1d7f2d8206fd5', '二测馆主03', 'admin', true, 'second beta full-permission test account'),
  ('f8e2545ff5cd57bfaa48de746bc33b9160915151026cc78a4d85eb0e6b78467b', '二测馆主04', 'admin', true, 'second beta full-permission test account'),
  ('07f037400327c2fe76013105c24ba276b0a03d9348a271f8f9a0949f722e6881', '二测馆主05', 'admin', true, 'second beta full-permission test account'),
  ('0114abc0aeca79dc2b826c34d40ca6cbf97412dd532470384a6941f6341f7e61', '二测馆主06', 'admin', true, 'second beta full-permission test account'),
  ('bfa69264bc564ec142dd5f6144eba4924450cd9aa8fc3e0c22febba75f059a1b', '二测馆主07', 'admin', true, 'second beta full-permission test account'),
  ('669f76b09b229a63a5cc259ba4807b3d49c78d314ac64da3ec2c0f8b1d91176a', '二测馆主08', 'admin', true, 'second beta full-permission test account'),
  ('e632682d19ad165941c6890eaf3b02e8ef8031030c9af572a1fd79b91ea87a2b', '二测馆主09', 'admin', true, 'second beta full-permission test account'),
  ('46ddb99862a2f29a81fbcd37d19239e04ebfa855c79d8560adabb4049cc1ab48', '二测馆主10', 'admin', true, 'second beta full-permission test account'),
  ('cec1f1a5b25ba4a8f3ec7ec278beb71d19c7a88f5806e99df32685504a80306a', '二测馆主11', 'admin', true, 'second beta full-permission test account'),
  ('20309802e913ac3fe9def5310a83028e929b03d9e8241c1687d11f89118d22ec', '二测馆主12', 'admin', true, 'second beta full-permission test account'),
  ('a2d640a8fdd67b5434c265dfd22c20b1c62ab076959e2624926f231aeebb37c3', '二测馆主13', 'admin', true, 'second beta full-permission test account'),
  ('d88213f8cc341baa6dedb34e93909e2fe3aec4f837a3dafd6e2bddfc8615f2fe', '二测馆主14', 'admin', true, 'second beta full-permission test account'),
  ('238b4efb2146e864fcff5621af001735cbf1b22d9c0dbc6955b912fcefefe262', '二测馆主15', 'admin', true, 'second beta full-permission test account'),
  ('d83d6705e85149743dfb85f2e2323fd89b31150a8dc3f6a0a0b5baf549cbc6b0', '二测馆主16', 'admin', true, 'second beta full-permission test account'),
  ('93e7d37c64e0a3d24ea2883f6afc152614f369bbb9405a8ae4e3ca8b2c285325', '二测馆主17', 'admin', true, 'second beta full-permission test account'),
  ('aab8950436492cf04f669f11d264a9ffe36460f58500dce743de664b94155400', '二测馆主18', 'admin', true, 'second beta full-permission test account'),
  ('a1fe9a52c2f3ea06290bade21a9341111516bc7581e513461163504dd28ea54b', '二测馆主19', 'admin', true, 'second beta full-permission test account'),
  ('3fe8c61bb9723747cd7c116a6670fd4133b0b684abcb6694052f427f0380a0bd', '二测馆主20', 'admin', true, 'second beta full-permission test account'),
  ('d653f91c28f694ccc937234a899fc75825ce1b667dbd9922b03d9db3ad7a67ec', '二测馆主21', 'admin', true, 'second beta full-permission test account'),
  ('d7a7c9950acbe9bb4f230a96c759177bf827fbc5208862df9069f871b70a8cc6', '二测馆主22', 'admin', true, 'second beta full-permission test account'),
  ('81c53ab853a71e945bee5a11aa5cc5c5d2ceb6a8714aa0fa796884bac7246322', '二测馆主23', 'admin', true, 'second beta full-permission test account'),
  ('164af06c3be318a95824db910680aa56e9a3f7763136ed87cb514bb6ddc8ad7c', '二测馆主24', 'admin', true, 'second beta full-permission test account'),
  ('5e176eb95c1626e0ec99835ce90dffcddfdfc807b4481f76e34c7371c7a10c57', '二测馆主25', 'admin', true, 'second beta full-permission test account'),
  ('684c771bab1a41fa9d73ab761c2ec7ce13c46dc3dc27f37702e84e1002a513e0', '二测馆主26', 'admin', true, 'second beta full-permission test account')
on conflict (code_hash) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  is_active = true,
  note = excluded.note,
  last_used_at = null;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.dungeons to anon, authenticated;
grant select on public.comments to anon, authenticated;
grant select on public.clear_feedback_summary to anon, authenticated;
grant select, insert, update, delete on public.dungeons to service_role;
grant select, insert, update, delete on public.ratings to service_role;
grant select, insert, update, delete on public.comments to service_role;
grant select, insert, update, delete on public.clear_records to service_role;
grant select, insert, update, delete on public.invite_codes to service_role;
grant select, insert, update, delete on public.player_profiles to service_role;

commit;
