-- Battle room lifecycle hotfix.
-- Adds 6-hour expiration support, manual extend/end, and overview data for the mini program.

begin;

alter table public.battle_rooms
  add column if not exists expires_at timestamptz;

update public.battle_rooms
set expires_at = created_at + interval '6 hours'
where expires_at is null;

alter table public.battle_rooms
  alter column expires_at set default (now() + interval '6 hours'),
  alter column expires_at set not null;

alter table public.battle_room_logs
  drop constraint if exists battle_room_logs_action_type_check;

alter table public.battle_room_logs
  add constraint battle_room_logs_action_type_check
  check (action_type in ('create', 'round', 'damage', 'heal', 'shield', 'set_hp', 'revive', 'defeat', 'note', 'finish', 'cancel', 'cooldown'));

create index if not exists battle_rooms_status_expires_idx
  on public.battle_rooms(room_status, expires_at desc, created_at desc);

grant select, insert, update, delete on public.battle_rooms to service_role;

commit;

-- Verification.
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'battle_rooms'
  and column_name = 'expires_at';

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.battle_room_logs'::regclass
  and conname = 'battle_room_logs_action_type_check';
