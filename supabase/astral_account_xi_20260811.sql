-- Starpath account for the Eternal Stele.
-- Run this whole script from the top in Supabase SQL Editor.
-- Login invite code: XINGTU-XI-987504

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.invite_codes
  drop constraint if exists invite_codes_role_check;
alter table public.invite_codes
  add constraint invite_codes_role_check
  check (role in ('player', 'author', 'reviewer', 'admin', 'god', 'astral'));

alter table public.player_profiles
  drop constraint if exists player_profiles_role_check;
alter table public.player_profiles
  add constraint player_profiles_role_check
  check (role in ('player', 'author', 'reviewer', 'admin'));

create unique index if not exists invite_codes_active_astral_name_unique
  on public.invite_codes (display_name)
  where role = 'astral' and is_active;

do $astral_account$
declare
  star_invite_code text := 'XINGTU-XI-987504';
  star_display_name text := '自由之神--曦';
  star_hash text := encode(extensions.digest(star_invite_code, 'sha256'), 'hex');
  matched_hashes text[];
begin
  if exists (
    select 1
    from public.invite_codes
    where code_hash = star_hash
      and display_name <> star_display_name
  ) then
    raise exception 'Invite code hash is already used by another account.';
  end if;

  select coalesce(array_agg(distinct code_hash), '{}'::text[])
  into matched_hashes
  from public.invite_codes
  where code_hash = star_hash
     or display_name = star_display_name;

  delete from public.player_profiles
  where display_name = star_display_name
     or invite_code_hash = star_hash
     or invite_code_hash = any(matched_hashes);

  if to_regclass('public.invite_sessions') is not null then
    execute
      'delete from public.invite_sessions where invite_code_hash = any($1) or invite_code_hash = $2'
      using matched_hashes, star_hash;
  end if;

  if exists (select 1 from public.invite_codes where display_name = star_display_name) then
    update public.invite_codes
    set code_hash = star_hash,
        role = 'astral',
        is_active = true,
        last_used_at = null,
        note = '星途账号：永恒神碑第一席'
    where display_name = star_display_name;
  else
    insert into public.invite_codes (code_hash, display_name, role, is_active, note)
    values (star_hash, star_display_name, 'astral', true, '星途账号：永恒神碑第一席');
  end if;
end
$astral_account$;

commit;

select
  display_name,
  role,
  is_active,
  note,
  left(code_hash, 8) as code_hash_prefix
from public.invite_codes
where display_name = '自由之神--曦';
