alter table public.dungeons
  add column if not exists co_creators text[] not null default '{}'::text[];

update public.dungeons
set co_creators = '{}'::text[]
where co_creators is null;

