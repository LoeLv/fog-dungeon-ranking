create table if not exists public.dungeons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  creator text not null check (char_length(trim(creator)) between 1 and 40),
  difficulty text not null default '超凡',
  type text not null default '综合',
  description text not null check (char_length(trim(description)) between 1 and 1800),
  pinned_note text not null default '',
  participant_count integer not null default 1 check (participant_count >= 1),
  run_count integer not null default 1 check (run_count >= 1),
  clear_count integer not null default 0 check (clear_count >= 0),
  clear_rate numeric(5, 2) not null default 0 check (clear_rate >= 0 and clear_rate <= 100),
  invite_code_hash text,
  invite_name text,
  avg_rating numeric(3, 1) not null default 0 check (avg_rating >= 0 and avg_rating <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  invite_code_hash text,
  invite_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author text not null default '匿名探索者' check (char_length(trim(author)) between 1 and 40),
  content text not null check (char_length(trim(content)) between 1 and 800),
  invite_code_hash text,
  invite_name text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.clear_records (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons(id) on delete cascade,
  run_number integer not null check (run_number >= 1),
  invite_code_hash text not null,
  invite_name text,
  feedback_tags text[] not null default '{}'::text[],
  feedback_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (char_length(code_hash) = 64),
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  role text not null check (role in ('player', 'author', 'admin')),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists dungeons_created_at_idx on public.dungeons(created_at desc);
create index if not exists dungeons_rating_idx on public.dungeons(avg_rating desc, created_at desc);
create index if not exists ratings_dungeon_id_idx on public.ratings(dungeon_id);
create unique index if not exists ratings_one_per_invite_code_idx
  on public.ratings(dungeon_id, invite_code_hash)
  where invite_code_hash is not null;
create index if not exists comments_dungeon_id_idx on public.comments(dungeon_id, created_at desc);
create index if not exists comments_parent_comment_id_idx on public.comments(parent_comment_id, created_at);
create index if not exists comments_latest_active_idx on public.comments(created_at desc) where is_deleted = false;
create index if not exists clear_records_dungeon_id_idx on public.clear_records(dungeon_id, run_number);
create index if not exists clear_records_feedback_tags_idx on public.clear_records using gin(feedback_tags);
create unique index if not exists clear_records_one_per_invite_run_idx
  on public.clear_records(dungeon_id, run_number, invite_code_hash);
create index if not exists invite_codes_role_idx on public.invite_codes(role, is_active);

alter table public.dungeons enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.clear_records enable row level security;
alter table public.invite_codes enable row level security;

drop policy if exists "Public dungeon read" on public.dungeons;
drop policy if exists "Public dungeon submit" on public.dungeons;
drop policy if exists "Public rating read" on public.ratings;
drop policy if exists "Public rating submit" on public.ratings;
drop policy if exists "Public comment read" on public.comments;
drop policy if exists "Public comment submit" on public.comments;

create policy "Public dungeon read"
on public.dungeons
for select
to anon, authenticated
using (true);

create policy "Public rating read"
on public.ratings
for select
to anon, authenticated
using (true);

create policy "Public comment read"
on public.comments
for select
to anon, authenticated
using (true);

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

grant usage on schema public to anon, authenticated;
grant select on public.dungeons to anon, authenticated;
grant select on public.ratings to anon, authenticated;
grant select on public.comments to anon, authenticated;
grant select on public.clear_feedback_summary to anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.dungeons to service_role;
grant select, insert, update, delete on public.ratings to service_role;
grant select, insert, update, delete on public.comments to service_role;
grant select, insert, update, delete on public.clear_records to service_role;
grant select, insert, update, delete on public.invite_codes to service_role;
