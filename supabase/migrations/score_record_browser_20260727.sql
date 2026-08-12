-- Run once in Supabase SQL Editor before deploying the matching Edge Function.
-- Align the stored settlement-entry range with the -3..3 audience rule.

begin;

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'score_settlement_entries'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%score_jin%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.score_settlement_entries drop constraint %I', constraint_name);
  end if;

  alter table public.score_settlement_entries
    drop constraint if exists score_settlement_entries_score_jin_check;

  alter table public.score_settlement_entries
    add constraint score_settlement_entries_score_jin_check
    check (score_jin >= -3 and score_jin <= 3);
end $$;

create index if not exists score_settlements_recent_dungeon_idx
  on public.score_settlements(created_at desc, dungeon_name);

commit;
