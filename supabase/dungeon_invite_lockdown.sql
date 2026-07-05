-- Run this after deploying the fog-dungeon-action Edge Function.
-- It keeps the ranking publicly readable, but all writes must go through the invite-checked function.

alter table public.dungeons alter column difficulty set default '超凡';
alter table public.dungeons alter column type set default '综合';
alter table public.comments alter column author set default '匿名探索者';

alter table public.dungeons enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Public dungeon submit" on public.dungeons;
drop policy if exists "Public rating submit" on public.ratings;
drop policy if exists "Public comment submit" on public.comments;

drop policy if exists "Public dungeon read" on public.dungeons;
create policy "Public dungeon read"
on public.dungeons
for select
to anon, authenticated
using (true);

drop policy if exists "Public rating read" on public.ratings;
create policy "Public rating read"
on public.ratings
for select
to anon, authenticated
using (true);

drop policy if exists "Public comment read" on public.comments;
create policy "Public comment read"
on public.comments
for select
to anon, authenticated
using (true);

revoke insert, update, delete on public.dungeons from anon, authenticated;
revoke insert, update, delete on public.ratings from anon, authenticated;
revoke insert, update, delete on public.comments from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.dungeons to anon, authenticated;
grant select on public.ratings to anon, authenticated;
grant select on public.comments to anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.dungeons to service_role;
grant select, insert, update, delete on public.ratings to service_role;
grant select, insert, update, delete on public.comments to service_role;
