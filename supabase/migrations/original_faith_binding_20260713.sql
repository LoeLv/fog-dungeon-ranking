-- Adds a permanent original-faith tag for profile binding rules.
-- Safe to run on the existing Supabase project.

alter table public.player_profiles
  add column if not exists original_faith_god text,
  add column if not exists original_faith_path text;

update public.player_profiles
set
  original_faith_god = coalesce(nullif(trim(original_faith_god), ''), faith_god),
  original_faith_path = coalesce(nullif(trim(original_faith_path), ''), faith_path)
where original_faith_god is null
   or trim(original_faith_god) = ''
   or original_faith_path is null
   or trim(original_faith_path) = '';

-- One-off repair for accounts that hit the old trickery-rebinding bug.
-- If another account hit the same old bug, add its display_name to this list.
update public.player_profiles
set
  original_faith_god = '欺诈',
  original_faith_path = '虚无',
  updated_at = now()
where display_name in ('白米粥', '祂');
