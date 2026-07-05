create table if not exists public.dungeons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  creator text not null check (char_length(trim(creator)) between 1 and 40),
  difficulty text not null default '超凡',
  type text not null default '综合',
  description text not null check (char_length(trim(description)) between 1 and 1800),
  avg_rating numeric(3, 1) not null default 0 check (avg_rating >= 0 and avg_rating <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons(id) on delete cascade,
  author text not null default '匿名探索者' check (char_length(trim(author)) between 1 and 40),
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists dungeons_created_at_idx on public.dungeons(created_at desc);
create index if not exists dungeons_rating_idx on public.dungeons(avg_rating desc, created_at desc);
create index if not exists ratings_dungeon_id_idx on public.ratings(dungeon_id);
create index if not exists comments_dungeon_id_idx on public.comments(dungeon_id, created_at desc);

alter table public.dungeons enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;

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

create policy "Public dungeon submit"
on public.dungeons
for insert
to anon, authenticated
with check (true);

create policy "Public rating read"
on public.ratings
for select
to anon, authenticated
using (true);

create policy "Public rating submit"
on public.ratings
for insert
to anon, authenticated
with check (rating between 1 and 5);

create policy "Public comment read"
on public.comments
for select
to anon, authenticated
using (true);

create policy "Public comment submit"
on public.comments
for insert
to anon, authenticated
with check (char_length(trim(content)) between 1 and 500);

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
    select count(*)::integer from public.comments where dungeon_id = target_dungeon_id
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
grant select, insert on public.dungeons to anon, authenticated;
grant select, insert on public.ratings to anon, authenticated;
grant select, insert on public.comments to anon, authenticated;
