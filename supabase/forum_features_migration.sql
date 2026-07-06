-- Forum features for the dungeon board.
-- Safe to run on the existing Supabase project.

alter table public.dungeons add column if not exists pinned_note text not null default '';

alter table public.comments add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists is_deleted boolean not null default false;
alter table public.comments add column if not exists deleted_at timestamptz;
alter table public.comments add column if not exists updated_at timestamptz;

alter table public.clear_records add column if not exists feedback_tags text[] not null default '{}'::text[];
alter table public.clear_records add column if not exists feedback_note text;

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

drop trigger if exists comments_recalculate_dungeon on public.comments;
create trigger comments_recalculate_dungeon
after insert or update or delete on public.comments
for each row execute function public.recalculate_dungeon_comments();

grant select on public.clear_feedback_summary to anon, authenticated;
grant select, insert, update, delete on public.comments to service_role;
grant select, update on public.dungeons to service_role;
grant select, insert, update, delete on public.clear_records to service_role;
