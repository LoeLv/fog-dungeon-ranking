-- Nickname binding for personal invite codes.
-- Safe to run on the existing Supabase project.

create unique index if not exists invite_codes_active_display_name_unique
on public.invite_codes (lower(display_name))
where is_active = true;
