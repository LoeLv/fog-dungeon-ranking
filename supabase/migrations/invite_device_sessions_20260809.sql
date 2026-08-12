-- Invite device sessions.
-- Allows one desktop session and one mobile session per invite code.
-- Running this script also forces every existing browser to log in again.

begin;

alter table public.invite_codes
  add column if not exists session_generation integer not null default 0 check (session_generation >= 0);

create table if not exists public.invite_sessions (
  invite_code_hash text not null check (char_length(invite_code_hash) = 64),
  device_kind text not null check (device_kind in ('desktop', 'mobile')),
  session_id text not null,
  session_generation integer not null default 0 check (session_generation >= 0),
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (invite_code_hash, device_kind)
);

create index if not exists invite_sessions_last_seen_idx
  on public.invite_sessions(last_seen_at desc);

-- Force all current saved browser sessions to become invalid.
update public.invite_codes
set session_generation = session_generation + 1;

delete from public.invite_sessions;

commit;

-- Verification.
select
  count(*) as invite_count,
  min(session_generation) as min_generation,
  max(session_generation) as max_generation
from public.invite_codes;

select count(*) as active_device_sessions
from public.invite_sessions;
