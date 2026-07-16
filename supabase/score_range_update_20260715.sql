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
    and pg_get_constraintdef(c.oid) like '%score_deng%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.score_settlement_entries drop constraint %I', constraint_name);
  end if;

  alter table public.score_settlement_entries
    drop constraint if exists score_settlement_entries_score_deng_check;

  alter table public.score_settlement_entries
    add constraint score_settlement_entries_score_deng_check
    check (score_deng >= -30 and score_deng <= 30);
end $$;
